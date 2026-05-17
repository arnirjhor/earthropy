/**
 * Tests for createPost.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups, postSdgs, posts, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPost } from './createPost.ts';

// ── Queue mock ──────────────────────────────────────────────────────────────
// vi.hoisted ensures the mock function is available when the factory runs,
// which is hoisted before any import in the module (required for ESM).
const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue({ id: 'fake-job-id' }),
}));

vi.mock('@repo/queue', () => ({
  enqueueModeration: (...args: unknown[]) => enqueueMock(...args),
  moderationQueue: () => ({ add: vi.fn() }),
  createModerationQueue: () => ({ add: vi.fn() }),
  MODERATION_QUEUE_NAME: 'moderation',
  MODERATION_JOB_OPTS: {},
}));

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testUserId = '';
let testGroupId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `post-test-${suffix}@example.com`,
    handle: `posttst-${suffix}`,
    displayName: `Post Test ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function insertTestGroup(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const slug = `test-group-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `Test Group ${id.slice(0, 8)}`,
    description: 'Test group for posts',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: userId,
  });
  // Insert primary SDG (id=13 Climate Action)
  await db.insert(groupSdgs).values({ groupId: id, sdgId: 13, primary: true });
  // Insert the creator as owner
  await db.insert(groupMembers).values({ groupId: id, userId, role: 'owner' });
  return id;
}

async function cleanupPost(id: string): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id));
}

async function cleanupGroup(id: string): Promise<void> {
  await db.delete(groups).where(eq(groups.id, id));
}

async function cleanupUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

beforeEach(async () => {
  testUserId = await insertTestUser();
  testGroupId = await insertTestGroup(testUserId);
  enqueueMock.mockClear();
  process.env.MODERATION_DISABLED = undefined;
});

afterEach(async () => {
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
  testGroupId = '';
  process.env.MODERATION_DISABLED = undefined;
});

describe('createPost — happy path', () => {
  it('inserts a post row and returns the created post', async () => {
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'My First Post',
        body: 'Climate action is urgent.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;

      expect(result.id).toBeTruthy();
      expect(result.title).toBe('My First Post');
      expect(result.status).toBe('pending_ai');
      expect(result.groupId).toBe(testGroupId);
      expect(result.authorId).toBe(testUserId);
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });

  it('inserts post_sdgs M2M rows for each sdgId', async () => {
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'SDG Multi',
        body: 'Covers multiple SDGs.',
        locale: 'en',
        sdgIds: [13, 15],
      });
      postId = result.id;

      const sdgRows = await db.select().from(postSdgs).where(eq(postSdgs.postId, postId));
      expect(sdgRows.length).toBe(2);
      const sdgIds = sdgRows.map((r) => r.sdgId).sort();
      expect(sdgIds).toEqual([13, 15]);
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });

  it('always sets status to pending_ai regardless of input', async () => {
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Status Test',
        body: 'Should always be pending_ai.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;
      expect(result.status).toBe('pending_ai');
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });
});

describe('createPost — SDG validation', () => {
  it('throws on an invalid sdgId', async () => {
    await expect(
      createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Bad SDG',
        body: 'Should fail.',
        locale: 'en',
        sdgIds: [99 as never],
      }),
    ).rejects.toThrow(/invalid sdg/i);
  });

  it('throws when sdgIds is empty', async () => {
    await expect(
      createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'No SDG',
        body: 'Should fail.',
        locale: 'en',
        sdgIds: [],
      }),
    ).rejects.toThrow(/sdg/i);
  });
});

describe('createPost — transaction rollback', () => {
  it('does not leave a post row when a bad sdgId causes insert failure', async () => {
    const title = `rollback-test-${crypto.randomUUID()}`;
    // sdgId=99 references a non-existent sdg; the post_sdgs FK will fail.
    await expect(
      createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title,
        body: 'Should rollback.',
        locale: 'en',
        sdgIds: [99 as never],
      }),
    ).rejects.toThrow();

    // No orphaned post row should exist
    const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.title, title));
    expect(rows.length).toBe(0);
  });
});

describe('createPost — moderation enqueue', () => {
  it('calls enqueueModeration once after successful insert', async () => {
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Enqueue Test',
        body: 'This post should be enqueued.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;

      expect(enqueueMock).toHaveBeenCalledOnce();
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });

  it('enqueues with correct targetType, targetId, locale, text, and context shape', async () => {
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Context Shape Test',
        body: 'Checking job payload.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;

      expect(enqueueMock).toHaveBeenCalledOnce();
      const [payload] = enqueueMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.targetType).toBe('post');
      expect(payload.targetId).toBe(result.id);
      expect(payload.locale).toBe('en');
      expect(typeof payload.text).toBe('string');
      expect((payload.text as string).length).toBeGreaterThan(0);
      const ctx = payload.context as Record<string, unknown>;
      expect(ctx.targetType).toBe('post');
      expect(Array.isArray(ctx.groupSdgCodes)).toBe(true);
      expect(typeof ctx.authorReputation).toBe('number');
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });

  it('enqueues group SDG codes resolved from the group row', async () => {
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'SDG Codes Test',
        body: 'Group has SDG 13.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;

      const [payload] = enqueueMock.mock.calls[0] as [Record<string, unknown>];
      const ctx = payload.context as Record<string, unknown>;
      expect(ctx.groupSdgCodes).toContain('13');
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });

  it('does not call enqueueModeration when MODERATION_DISABLED=1', async () => {
    process.env.MODERATION_DISABLED = '1';
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Disabled Test',
        body: 'No moderation.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;

      expect(enqueueMock).not.toHaveBeenCalled();
    } finally {
      if (postId) await cleanupPost(postId);
      process.env.MODERATION_DISABLED = undefined;
    }
  });

  it('immediately sets status=published when MODERATION_DISABLED=1', async () => {
    process.env.MODERATION_DISABLED = '1';
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Published Disabled',
        body: 'Should be published right away.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;

      expect(result.status).toBe('published');

      const rows = await db
        .select({ status: posts.status })
        .from(posts)
        .where(eq(posts.id, result.id));
      expect(rows[0]?.status).toBe('published');
    } finally {
      if (postId) await cleanupPost(postId);
      process.env.MODERATION_DISABLED = undefined;
    }
  });

  it('still returns the post even if enqueueModeration rejects (fire-and-forget)', async () => {
    enqueueMock.mockRejectedValueOnce(new Error('redis unavailable'));
    let postId = '';
    try {
      const result = await createPost({
        groupId: testGroupId,
        authorId: testUserId,
        title: 'Enqueue Error Safety',
        body: 'Redis down should not fail create.',
        locale: 'en',
        sdgIds: [13],
      });
      postId = result.id;
      expect(result.id).toBeTruthy();
      expect(result.status).toBe('pending_ai');
    } finally {
      if (postId) await cleanupPost(postId);
    }
  });
});
