/**
 * Tests for listCommentsForPost.
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
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listCommentsForPost } from './listCommentsForPost.ts';

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
    email: `list-cmt-${suffix}@example.com`,
    handle: `listcmt-${suffix}`.slice(0, 30),
    displayName: `ListCmt ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function insertTestGroup(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const slug = `lc-grp-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `ListCmt Group ${id.slice(0, 8)}`,
    description: 'Test group for listing comments',
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
    title: `List test post ${id.slice(0, 8)}`,
    body: 'Test post body.',
    locale: 'en',
    status: 'published',
    publishedAt: new Date(),
  });
  await db.insert(postSdgs).values({ postId: id, sdgId: 13 });
  return id;
}

async function insertComment(
  postId: string,
  authorId: string,
  opts: {
    body?: string;
    parentCommentId?: string | null;
    status?: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(comments).values({
    id,
    postId,
    authorId,
    body: opts.body ?? `Comment body ${id.slice(0, 8)}`,
    locale: 'en',
    status: opts.status ?? 'published',
    parentCommentId: opts.parentCommentId ?? null,
  });
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

describe('listCommentsForPost — ordering', () => {
  it('returns comments ordered by createdAt ascending', async () => {
    // Insert 3 top-level comments in sequence (DB timestamps are sufficient)
    const id1 = await insertComment(testPostId, testUserId, { body: 'First' });
    const id2 = await insertComment(testPostId, testUserId, { body: 'Second' });
    const id3 = await insertComment(testPostId, testUserId, { body: 'Third' });

    try {
      const rows = await listCommentsForPost(testPostId, {});
      const bodies = rows.map((r) => r.body);
      expect(bodies).toContain('First');
      expect(bodies).toContain('Second');
      expect(bodies).toContain('Third');
      // Check ordering: First appears before Second, Second before Third
      expect(bodies.indexOf('First')).toBeLessThan(bodies.indexOf('Second'));
      expect(bodies.indexOf('Second')).toBeLessThan(bodies.indexOf('Third'));
    } finally {
      await db.delete(comments).where(eq(comments.id, id1));
      await db.delete(comments).where(eq(comments.id, id2));
      await db.delete(comments).where(eq(comments.id, id3));
    }
  });

  it('returns only published comments by default', async () => {
    const pubId = await insertComment(testPostId, testUserId, { status: 'published' });
    const pendingId = await insertComment(testPostId, testUserId, { status: 'pending_ai' });
    try {
      const rows = await listCommentsForPost(testPostId, {});
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(pubId);
      expect(ids).not.toContain(pendingId);
    } finally {
      await db.delete(comments).where(eq(comments.id, pubId));
      await db.delete(comments).where(eq(comments.id, pendingId));
    }
  });

  it('accepts explicit status filter', async () => {
    const pendingId = await insertComment(testPostId, testUserId, { status: 'pending_ai' });
    try {
      const rows = await listCommentsForPost(testPostId, { status: 'pending_ai' });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(pendingId);
    } finally {
      await db.delete(comments).where(eq(comments.id, pendingId));
    }
  });
});

describe('listCommentsForPost — tree shape', () => {
  it('top-level comments have null parentCommentId', async () => {
    const topId = await insertComment(testPostId, testUserId, { body: 'Top level' });
    try {
      const rows = await listCommentsForPost(testPostId, {});
      const top = rows.find((r) => r.id === topId);
      expect(top).toBeDefined();
      expect(top?.parentCommentId).toBeNull();
    } finally {
      await db.delete(comments).where(eq(comments.id, topId));
    }
  });

  it('child comments reference their parent id', async () => {
    const parentId = await insertComment(testPostId, testUserId, { body: 'Parent' });
    const childId = await insertComment(testPostId, testUserId, {
      body: 'Child',
      parentCommentId: parentId,
    });
    try {
      const rows = await listCommentsForPost(testPostId, {});
      const child = rows.find((r) => r.id === childId);
      expect(child).toBeDefined();
      expect(child?.parentCommentId).toBe(parentId);
    } finally {
      await db.delete(comments).where(eq(comments.id, childId));
      await db.delete(comments).where(eq(comments.id, parentId));
    }
  });

  it('flat list includes both parents and children; callers derive tree', async () => {
    const parentId = await insertComment(testPostId, testUserId, { body: 'Parent node' });
    const child1Id = await insertComment(testPostId, testUserId, {
      body: 'Child 1',
      parentCommentId: parentId,
    });
    const child2Id = await insertComment(testPostId, testUserId, {
      body: 'Child 2',
      parentCommentId: parentId,
    });
    try {
      const rows = await listCommentsForPost(testPostId, {});
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(parentId);
      expect(ids).toContain(child1Id);
      expect(ids).toContain(child2Id);
    } finally {
      await db.delete(comments).where(eq(comments.id, child2Id));
      await db.delete(comments).where(eq(comments.id, child1Id));
      await db.delete(comments).where(eq(comments.id, parentId));
    }
  });
});
