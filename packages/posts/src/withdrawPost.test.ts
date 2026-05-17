/**
 * Tests for withdrawPost.
 * Uses running Postgres on :5434.
 */
import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups, postSdgs, posts, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withdrawPost } from './withdrawPost.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testAuthorId = '';
let testOtherId = '';
let testGroupId = '';

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
  const slug = `wdgrp-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `Withdraw Group ${id.slice(0, 8)}`,
    description: 'Test group for withdraw',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: userId,
  });
  await db.insert(groupSdgs).values({ groupId: id, sdgId: 13, primary: true });
  await db.insert(groupMembers).values({ groupId: id, userId, role: 'owner' });
  return id;
}

async function insertPublishedPost(groupId: string, authorId: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(posts).values({
    id,
    groupId,
    authorId,
    title: `Published post ${id.slice(0, 8)}`,
    body: 'Published content.',
    locale: 'en',
    status: 'published',
    publishedAt: new Date(),
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
  testAuthorId = await insertTestUser('author');
  testOtherId = await insertTestUser('other');
  testGroupId = await insertTestGroup(testAuthorId);
});

afterEach(async () => {
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testAuthorId) await cleanupUser(testAuthorId);
  if (testOtherId) await cleanupUser(testOtherId);
  testAuthorId = '';
  testOtherId = '';
  testGroupId = '';
});

describe('withdrawPost', () => {
  it('author can withdraw their published post', async () => {
    const postId = await insertPublishedPost(testGroupId, testAuthorId);
    try {
      const result = await withdrawPost(postId, testAuthorId);
      expect(result.status).toBe('withdrawn');
      expect(result.id).toBe(postId);
    } finally {
      await cleanupPost(postId);
    }
  });

  it('non-author cannot withdraw the post', async () => {
    const postId = await insertPublishedPost(testGroupId, testAuthorId);
    try {
      await expect(withdrawPost(postId, testOtherId)).rejects.toThrow(/not the author/i);
    } finally {
      await cleanupPost(postId);
    }
  });

  it('throws when post does not exist', async () => {
    const nonExistentId = crypto.randomUUID();
    await expect(withdrawPost(nonExistentId, testAuthorId)).rejects.toThrow(/not found/i);
  });
});
