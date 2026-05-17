/**
 * Tests for withdrawComment.
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
import { withdrawComment } from './withdrawComment.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testAuthorId = '';
let testOtherId = '';
let testGroupId = '';
let testPostId = '';

async function insertTestUser(prefix: string): Promise<string> {
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
  const slug = `wd-cmt-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `Withdraw Comment Group ${id.slice(0, 8)}`,
    description: 'Test group for withdraw comment',
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
    title: `Withdraw test post ${id.slice(0, 8)}`,
    body: 'Test post body.',
    locale: 'en',
    status: 'published',
    publishedAt: new Date(),
  });
  await db.insert(postSdgs).values({ postId: id, sdgId: 13 });
  return id;
}

async function insertPublishedComment(postId: string, authorId: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(comments).values({
    id,
    postId,
    authorId,
    body: `Published comment ${id.slice(0, 8)}`,
    locale: 'en',
    status: 'published',
    publishedAt: new Date(),
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
  testAuthorId = await insertTestUser('wc-author');
  testOtherId = await insertTestUser('wc-other');
  testGroupId = await insertTestGroup(testAuthorId);
  testPostId = await insertTestPost(testGroupId, testAuthorId);
});

afterEach(async () => {
  if (testPostId) await cleanupPost(testPostId);
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testAuthorId) await cleanupUser(testAuthorId);
  if (testOtherId) await cleanupUser(testOtherId);
  testAuthorId = '';
  testOtherId = '';
  testGroupId = '';
  testPostId = '';
});

describe('withdrawComment', () => {
  it('author can withdraw their published comment', async () => {
    const commentId = await insertPublishedComment(testPostId, testAuthorId);
    try {
      const result = await withdrawComment(commentId, testAuthorId);
      expect(result.status).toBe('withdrawn');
      expect(result.id).toBe(commentId);
    } finally {
      await cleanupComment(commentId);
    }
  });

  it('non-author cannot withdraw the comment', async () => {
    const commentId = await insertPublishedComment(testPostId, testAuthorId);
    try {
      await expect(withdrawComment(commentId, testOtherId)).rejects.toThrow(/not the author/i);
    } finally {
      await cleanupComment(commentId);
    }
  });

  it('throws when comment does not exist', async () => {
    const nonExistentId = crypto.randomUUID();
    await expect(withdrawComment(nonExistentId, testAuthorId)).rejects.toThrow(/not found/i);
  });
});
