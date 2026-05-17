/**
 * Tests for updateCommentStatus.
 * Uses running Postgres on :5434.
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
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IllegalTransitionError } from './index.ts';
import { updateCommentStatus } from './updateCommentStatus.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testUserId = '';
let testGroupId = '';
let testPostId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `upd-cmt-${suffix}@example.com`,
    handle: `updcmt-${suffix}`.slice(0, 30),
    displayName: `UpdCmt ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function insertTestGroup(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const slug = `uc-grp-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `UpdCmt Group ${id.slice(0, 8)}`,
    description: 'Test group for comment status updates',
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
    title: `Status test post ${id.slice(0, 8)}`,
    body: 'Test post body.',
    locale: 'en',
    status: 'published',
    publishedAt: new Date(),
  });
  await db.insert(postSdgs).values({ postId: id, sdgId: 13 });
  return id;
}

async function insertCommentWithStatus(
  postId: string,
  authorId: string,
  status: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn',
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(comments).values({
    id,
    postId,
    authorId,
    body: `Comment ${id.slice(0, 8)}`,
    locale: 'en',
    status,
  });
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
});

afterEach(async () => {
  if (testPostId) await cleanupPost(testPostId);
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
  testGroupId = '';
  testPostId = '';
});

describe('updateCommentStatus — legal transitions', () => {
  it('pending_ai → published', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'pending_ai');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.status).toBe('published');
    } finally {
      await cleanupComment(id);
    }
  });

  it('pending_ai → pending_review', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'pending_ai');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'pending_review',
        actorId: testUserId,
      });
      expect(updated.status).toBe('pending_review');
    } finally {
      await cleanupComment(id);
    }
  });

  it('pending_ai → rejected', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'pending_ai');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'rejected',
        reason: 'Violates policy',
        actorId: testUserId,
      });
      expect(updated.status).toBe('rejected');
      expect(updated.statusReason).toBe('Violates policy');
    } finally {
      await cleanupComment(id);
    }
  });

  it('pending_review → published', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'pending_review');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.status).toBe('published');
    } finally {
      await cleanupComment(id);
    }
  });

  it('pending_review → rejected', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'pending_review');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'rejected',
        reason: 'Human reject',
        actorId: testUserId,
      });
      expect(updated.status).toBe('rejected');
    } finally {
      await cleanupComment(id);
    }
  });

  it('published → withdrawn', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'published');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'withdrawn',
        actorId: testUserId,
      });
      expect(updated.status).toBe('withdrawn');
    } finally {
      await cleanupComment(id);
    }
  });

  it('rejected → published (appeal upheld)', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'rejected');
    try {
      const updated = await updateCommentStatus(id, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.status).toBe('published');
    } finally {
      await cleanupComment(id);
    }
  });
});

describe('updateCommentStatus — publishedAt set on → published', () => {
  it('sets publishedAt when transitioning to published from pending_ai', async () => {
    const id = await insertCommentWithStatus(testPostId, testUserId, 'pending_ai');
    try {
      const before = new Date();
      const updated = await updateCommentStatus(id, {
        newStatus: 'published',
        actorId: testUserId,
      });
      const after = new Date();
      expect(updated.publishedAt).toBeTruthy();
      const publishedAtMs = updated.publishedAt?.getTime() ?? 0;
      expect(publishedAtMs).toBeGreaterThanOrEqual(before.getTime());
      expect(publishedAtMs).toBeLessThanOrEqual(after.getTime() + 1000);
    } finally {
      await cleanupComment(id);
    }
  });
});

describe('updateCommentStatus — illegal transitions throw IllegalTransitionError', () => {
  const illegalCases: Array<{
    from: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
    to: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  }> = [
    { from: 'published', to: 'pending_ai' },
    { from: 'published', to: 'pending_review' },
    { from: 'published', to: 'rejected' },
    { from: 'rejected', to: 'pending_ai' },
    { from: 'rejected', to: 'pending_review' },
    { from: 'rejected', to: 'withdrawn' },
    { from: 'withdrawn', to: 'pending_ai' },
    { from: 'withdrawn', to: 'pending_review' },
    { from: 'withdrawn', to: 'published' },
    { from: 'withdrawn', to: 'rejected' },
    { from: 'pending_ai', to: 'withdrawn' },
    { from: 'pending_review', to: 'withdrawn' },
    { from: 'pending_review', to: 'pending_ai' },
  ];

  for (const { from, to } of illegalCases) {
    it(`${from} → ${to} throws IllegalTransitionError`, async () => {
      const id = await insertCommentWithStatus(testPostId, testUserId, from);
      try {
        await expect(
          updateCommentStatus(id, { newStatus: to, actorId: testUserId }),
        ).rejects.toBeInstanceOf(IllegalTransitionError);
      } finally {
        await cleanupComment(id);
      }
    });
  }
});
