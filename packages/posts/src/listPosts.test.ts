/**
 * Tests for listPostsInGroup and listPostsForFeed.
 * Uses running Postgres on :5434.
 */
import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups, postSdgs, posts, users } from '@repo/database/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listPostsForFeed, listPostsInGroup } from './listPosts.ts';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://earthropy:earthropy@localhost:5434/earthropy';
});

let testUserId = '';
let testGroupId = '';
let testOtherGroupId = '';

async function insertTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const suffix = id.slice(0, 8);
  await db.insert(users).values({
    id,
    email: `list-post-${suffix}@example.com`,
    handle: `listpost-${suffix}`,
    displayName: `ListPost ${suffix}`,
    locale: 'en',
    emailVerifiedAt: new Date(),
  });
  return id;
}

async function insertTestGroup(userId: string, primarySdgId = 13): Promise<string> {
  const id = crypto.randomUUID();
  const slug = `lstgrp-${id.slice(0, 8)}`;
  await db.insert(groups).values({
    id,
    slug,
    name: `List Group ${id.slice(0, 8)}`,
    description: 'Test group for listing',
    visibility: 'public',
    preferredLocale: 'en',
    locationText: null,
    createdBy: userId,
  });
  await db.insert(groupSdgs).values({ groupId: id, sdgId: primarySdgId, primary: true });
  await db.insert(groupMembers).values({ groupId: id, userId, role: 'owner' });
  return id;
}

async function insertPost(
  groupId: string,
  authorId: string,
  status: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn',
  sdgIds: number[] = [13],
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(posts).values({
    id,
    groupId,
    authorId,
    title: `Post ${id.slice(0, 8)}`,
    body: 'Test body.',
    locale: 'en',
    status,
    publishedAt: status === 'published' ? new Date() : null,
  });
  for (const sdgId of sdgIds) {
    await db.insert(postSdgs).values({ postId: id, sdgId });
  }
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
  testGroupId = await insertTestGroup(testUserId, 13);
  testOtherGroupId = await insertTestGroup(testUserId, 7);
});

afterEach(async () => {
  if (testGroupId) await cleanupGroup(testGroupId);
  if (testOtherGroupId) await cleanupGroup(testOtherGroupId);
  if (testUserId) await cleanupUser(testUserId);
  testUserId = '';
  testGroupId = '';
  testOtherGroupId = '';
});

describe('listPostsInGroup', () => {
  it('returns published posts for a group', async () => {
    const p1 = await insertPost(testGroupId, testUserId, 'published');
    const p2 = await insertPost(testGroupId, testUserId, 'published');
    const p3 = await insertPost(testGroupId, testUserId, 'pending_ai');
    try {
      const result = await listPostsInGroup({ groupId: testGroupId, status: 'published' });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(p1);
      expect(ids).toContain(p2);
      expect(ids).not.toContain(p3);
    } finally {
      await cleanupPost(p1);
      await cleanupPost(p2);
      await cleanupPost(p3);
    }
  });

  it('filters by status when specified', async () => {
    const p1 = await insertPost(testGroupId, testUserId, 'pending_ai');
    const p2 = await insertPost(testGroupId, testUserId, 'published');
    try {
      const result = await listPostsInGroup({ groupId: testGroupId, status: 'pending_ai' });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(p1);
      expect(ids).not.toContain(p2);
    } finally {
      await cleanupPost(p1);
      await cleanupPost(p2);
    }
  });

  it('does not return posts from other groups', async () => {
    const p1 = await insertPost(testGroupId, testUserId, 'published');
    const p2 = await insertPost(testOtherGroupId, testUserId, 'published', [7]);
    try {
      const result = await listPostsInGroup({ groupId: testGroupId, status: 'published' });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(p1);
      expect(ids).not.toContain(p2);
    } finally {
      await cleanupPost(p1);
      await cleanupPost(p2);
    }
  });

  it('respects limit and offset', async () => {
    const p1 = await insertPost(testGroupId, testUserId, 'published');
    const p2 = await insertPost(testGroupId, testUserId, 'published');
    try {
      const page1 = await listPostsInGroup({
        groupId: testGroupId,
        status: 'published',
        limit: 1,
        offset: 0,
      });
      expect(page1.length).toBe(1);

      const page2 = await listPostsInGroup({
        groupId: testGroupId,
        status: 'published',
        limit: 1,
        offset: 1,
      });
      expect(page2.length).toBe(1);

      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    } finally {
      await cleanupPost(p1);
      await cleanupPost(p2);
    }
  });
});

describe('listPostsForFeed', () => {
  it('returns published posts from groups the user is a member of', async () => {
    const p1 = await insertPost(testGroupId, testUserId, 'published');
    const p2 = await insertPost(testOtherGroupId, testUserId, 'published', [7]);
    try {
      const result = await listPostsForFeed({ userId: testUserId });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(p1);
      expect(ids).toContain(p2);
    } finally {
      await cleanupPost(p1);
      await cleanupPost(p2);
    }
  });

  it('does not return posts from groups the user is not a member of', async () => {
    // Create a third group the user doesn't belong to
    const nonMemberGroup = await insertTestGroup(testUserId, 14);
    // Remove the user from that group
    await db.delete(groupMembers).where(eq(groupMembers.groupId, nonMemberGroup));
    const p1 = await insertPost(nonMemberGroup, testUserId, 'published', [14]);
    try {
      const result = await listPostsForFeed({ userId: testUserId });
      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(p1);
    } finally {
      await cleanupPost(p1);
      await cleanupGroup(nonMemberGroup);
    }
  });

  it('sdgIds adds posts from non-member groups tagged with those SDGs (OR-union semantic)', async () => {
    // B-DASH-1 redefined listPostsForFeed: feed = posts from joined groups
    // UNION posts tagged with followed SDGs (regardless of membership). This
    // tests the union behavior, not strict filtering.
    const nonMemberGroup = await insertTestGroup(testUserId, 13);
    await db.delete(groupMembers).where(eq(groupMembers.groupId, nonMemberGroup));
    const memberPost = await insertPost(testGroupId, testUserId, 'published', [7]);
    const outsidePostTaggedFollowed = await insertPost(nonMemberGroup, testUserId, 'published', [13]);
    const outsidePostNotTagged = await insertPost(nonMemberGroup, testUserId, 'published', [14]);
    try {
      const result = await listPostsForFeed({ userId: testUserId, sdgIds: [13] });
      const ids = result.map((r) => r.id);
      // Member-group post is always included (the "joined groups" leg)
      expect(ids).toContain(memberPost);
      // Non-member post tagged with a followed SDG is included (the union leg)
      expect(ids).toContain(outsidePostTaggedFollowed);
      // Non-member post NOT tagged with a followed SDG is excluded
      expect(ids).not.toContain(outsidePostNotTagged);
    } finally {
      await cleanupPost(memberPost);
      await cleanupPost(outsidePostTaggedFollowed);
      await cleanupPost(outsidePostNotTagged);
      await cleanupGroup(nonMemberGroup);
    }
  });
});
