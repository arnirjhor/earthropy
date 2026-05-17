/**
 * Tests for updatePostStatus.
 * Uses running Postgres on :5434.
 */
import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups, postSdgs, posts, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IllegalTransitionError } from './index.ts';
import { updatePostStatus } from './updatePostStatus.ts';

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
    email: `upd-status-${suffix}@example.com`,
    handle: `updstatus-${suffix}`,
    displayName: `UpdateStatus ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function insertTestGroup(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const slug = `tstgrp-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `Upd Group ${id.slice(0, 8)}`,
    description: 'Test group for status updates',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: userId,
  });
  await db.insert(groupSdgs).values({ groupId: id, sdgId: 13, primary: true });
  await db.insert(groupMembers).values({ groupId: id, userId, role: 'owner' });
  return id;
}

/** Insert a post directly with a given status (bypasses state machine for test setup). */
async function insertPostWithStatus(
  groupId: string,
  authorId: string,
  status: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn',
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(posts).values({
    id,
    groupId,
    authorId,
    title: `Test post ${id.slice(0, 8)}`,
    body: 'Test body.',
    locale: 'en',
    status,
  });
  await db.insert(postSdgs).values({ postId: id, sdgId: 13 });
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
});

afterEach(async () => {
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
  testGroupId = '';
});

describe('updatePostStatus — legal transitions', () => {
  it('pending_ai → published', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_ai');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.status).toBe('published');
    } finally {
      await cleanupPost(postId);
    }
  });

  it('pending_ai → pending_review', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_ai');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'pending_review',
        actorId: testUserId,
      });
      expect(updated.status).toBe('pending_review');
    } finally {
      await cleanupPost(postId);
    }
  });

  it('pending_ai → rejected', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_ai');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'rejected',
        reason: 'Violates policy',
        actorId: testUserId,
      });
      expect(updated.status).toBe('rejected');
      expect(updated.statusReason).toBe('Violates policy');
    } finally {
      await cleanupPost(postId);
    }
  });

  it('pending_review → published', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_review');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.status).toBe('published');
    } finally {
      await cleanupPost(postId);
    }
  });

  it('pending_review → rejected', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_review');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'rejected',
        reason: 'Human reject',
        actorId: testUserId,
      });
      expect(updated.status).toBe('rejected');
    } finally {
      await cleanupPost(postId);
    }
  });

  it('published → withdrawn', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'published');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'withdrawn',
        actorId: testUserId,
      });
      expect(updated.status).toBe('withdrawn');
    } finally {
      await cleanupPost(postId);
    }
  });

  it('rejected → published (appeal upheld)', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'rejected');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.status).toBe('published');
    } finally {
      await cleanupPost(postId);
    }
  });
});

describe('updatePostStatus — published_at set on → published', () => {
  it('sets publishedAt when transitioning to published from pending_ai', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_ai');
    try {
      const before = new Date();
      const updated = await updatePostStatus(postId, {
        newStatus: 'published',
        actorId: testUserId,
      });
      const after = new Date();

      expect(updated.publishedAt).toBeTruthy();
      const publishedAtMs = updated.publishedAt?.getTime() ?? 0;
      expect(publishedAtMs).toBeGreaterThanOrEqual(before.getTime());
      expect(publishedAtMs).toBeLessThanOrEqual(after.getTime() + 1000);
    } finally {
      await cleanupPost(postId);
    }
  });

  it('sets publishedAt when transitioning to published from pending_review', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'pending_review');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.publishedAt).toBeTruthy();
    } finally {
      await cleanupPost(postId);
    }
  });

  it('sets publishedAt when transitioning to published from rejected (appeal)', async () => {
    const postId = await insertPostWithStatus(testGroupId, testUserId, 'rejected');
    try {
      const updated = await updatePostStatus(postId, {
        newStatus: 'published',
        actorId: testUserId,
      });
      expect(updated.publishedAt).toBeTruthy();
    } finally {
      await cleanupPost(postId);
    }
  });
});

describe('updatePostStatus — illegal transitions throw IllegalTransitionError', () => {
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
      const postId = await insertPostWithStatus(testGroupId, testUserId, from);
      try {
        await expect(
          updatePostStatus(postId, { newStatus: to, actorId: testUserId }),
        ).rejects.toBeInstanceOf(IllegalTransitionError);
      } finally {
        await cleanupPost(postId);
      }
    });
  }
});
