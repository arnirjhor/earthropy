/**
 * Tests for createComment.
 * Uses running Postgres on :5434; cleanup via try/finally.
 */
import { db } from '@repo/database/client';
import {
  comments,
  groupMembers,
  groupSdgs,
  groups,
  postSdgs,
  posts,
  users,
} from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createComment } from './createComment.ts';

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
let testPostId = '';

async function insertTestUser(prefix = 'comment-test'): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `${prefix}-${suffix}@example.com`,
    handle: `${prefix}-${suffix}`.slice(0, 30),
    displayName: `${prefix} ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function insertTestGroup(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const slug = `cmt-grp-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `Comment Group ${id.slice(0, 8)}`,
    description: 'Test group for comments',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: userId,
  });
  await db.insert(groupSdgs).values({ groupId: id, sdgId: 13, primary: true });
  await db.insert(groupMembers).values({ groupId: id, userId, role: 'owner' });
  return id;
}

async function insertTestPost(groupId: string, authorId: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(posts).values({
    id,
    groupId,
    authorId,
    title: `Test post ${id.slice(0, 8)}`,
    body: 'Test post body.',
    locale: 'en',
    status: 'published',
    publishedAt: new Date(),
  });
  await db.insert(postSdgs).values({ postId: id, sdgId: 13 });
  return id;
}

async function cleanupComment(id: string): Promise<void> {
  await db.delete(comments).where(eq(comments.id, id));
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
  testPostId = await insertTestPost(testGroupId, testUserId);
  enqueueMock.mockClear();
  process.env.MODERATION_DISABLED = undefined;
});

afterEach(async () => {
  if (testPostId) await cleanupPost(testPostId);
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
  testGroupId = '';
  testPostId = '';
  process.env.MODERATION_DISABLED = undefined;
});

describe('createComment — happy path', () => {
  it('inserts a top-level comment with status pending_ai', async () => {
    let commentId = '';
    try {
      const result = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Great post on climate action!',
        locale: 'en',
      });
      commentId = result.id;

      expect(result.id).toBeTruthy();
      expect(result.postId).toBe(testPostId);
      expect(result.authorId).toBe(testUserId);
      expect(result.body).toBe('Great post on climate action!');
      expect(result.status).toBe('pending_ai');
      expect(result.parentCommentId).toBeNull();
    } finally {
      if (commentId) await cleanupComment(commentId);
    }
  });

  it('inserts a reply (parent on same post)', async () => {
    let parentId = '';
    let replyId = '';
    try {
      const parent = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Parent comment.',
        locale: 'en',
      });
      parentId = parent.id;

      const reply = await createComment({
        postId: testPostId,
        authorId: testUserId,
        parentCommentId: parentId,
        body: 'Reply to parent.',
        locale: 'en',
      });
      replyId = reply.id;

      expect(reply.parentCommentId).toBe(parentId);
      expect(reply.postId).toBe(testPostId);
      expect(reply.status).toBe('pending_ai');
    } finally {
      if (replyId) await cleanupComment(replyId);
      if (parentId) await cleanupComment(parentId);
    }
  });
});

describe('createComment — parent on different post rejection', () => {
  it('rejects if parentCommentId belongs to a different post', async () => {
    const otherPostId = await insertTestPost(testGroupId, testUserId);
    let parentId = '';
    try {
      const parent = await createComment({
        postId: otherPostId,
        authorId: testUserId,
        body: 'Parent on other post.',
        locale: 'en',
      });
      parentId = parent.id;

      await expect(
        createComment({
          postId: testPostId,
          authorId: testUserId,
          parentCommentId: parentId,
          body: 'Reply to cross-post parent — should fail.',
          locale: 'en',
        }),
      ).rejects.toThrow(/parent comment.*different post/i);
    } finally {
      if (parentId) await cleanupComment(parentId);
      await cleanupPost(otherPostId);
    }
  });
});

describe('createComment — moderation enqueue', () => {
  it('calls enqueueModeration once after successful insert', async () => {
    let commentId = '';
    try {
      const result = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Enqueue test comment.',
        locale: 'en',
      });
      commentId = result.id;

      expect(enqueueMock).toHaveBeenCalledOnce();
    } finally {
      if (commentId) await cleanupComment(commentId);
    }
  });

  it('enqueues with correct targetType, targetId, locale, text, and context shape', async () => {
    let commentId = '';
    try {
      const result = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Context shape verification.',
        locale: 'en',
      });
      commentId = result.id;

      expect(enqueueMock).toHaveBeenCalledOnce();
      const [payload] = enqueueMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.targetType).toBe('comment');
      expect(payload.targetId).toBe(result.id);
      expect(payload.locale).toBe('en');
      expect(typeof payload.text).toBe('string');
      expect((payload.text as string).length).toBeGreaterThan(0);
      const ctx = payload.context as Record<string, unknown>;
      expect(ctx.targetType).toBe('comment');
      expect(Array.isArray(ctx.groupSdgCodes)).toBe(true);
      expect(typeof ctx.authorReputation).toBe('number');
    } finally {
      if (commentId) await cleanupComment(commentId);
    }
  });

  it('does not call enqueueModeration when MODERATION_DISABLED=1', async () => {
    process.env.MODERATION_DISABLED = '1';
    let commentId = '';
    try {
      const result = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Disabled enqueue test.',
        locale: 'en',
      });
      commentId = result.id;

      expect(enqueueMock).not.toHaveBeenCalled();
    } finally {
      if (commentId) await cleanupComment(commentId);
      process.env.MODERATION_DISABLED = undefined;
    }
  });

  it('immediately sets status=published when MODERATION_DISABLED=1', async () => {
    process.env.MODERATION_DISABLED = '1';
    let commentId = '';
    try {
      const result = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Should be published immediately.',
        locale: 'en',
      });
      commentId = result.id;

      expect(result.status).toBe('published');

      const rows = await db
        .select({ status: comments.status })
        .from(comments)
        .where(eq(comments.id, result.id));
      expect(rows[0]?.status).toBe('published');
    } finally {
      if (commentId) await cleanupComment(commentId);
      process.env.MODERATION_DISABLED = undefined;
    }
  });

  it('still returns the comment even if enqueueModeration rejects (fire-and-forget)', async () => {
    enqueueMock.mockRejectedValueOnce(new Error('redis unavailable'));
    let commentId = '';
    try {
      const result = await createComment({
        postId: testPostId,
        authorId: testUserId,
        body: 'Redis down should not fail comment create.',
        locale: 'en',
      });
      commentId = result.id;
      expect(result.id).toBeTruthy();
      expect(result.status).toBe('pending_ai');
    } finally {
      if (commentId) await cleanupComment(commentId);
    }
  });
});
