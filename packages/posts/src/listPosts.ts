import { db } from '@repo/database/client';
import { groupMembers, postSdgs, posts } from '@repo/database/schema';
import { and, eq, inArray } from 'drizzle-orm';

export interface ListPostsInGroupInput {
  groupId: string;
  status?: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  limit?: number;
  offset?: number;
}

export interface PostRow {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  locale: string;
  status: 'pending_ai' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';
  statusReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * List posts in a group, optionally filtered by status.
 *
 * Defaults to `published` when no status is provided.
 * Does not enforce auth — the caller must pass the appropriate status filter.
 */
export async function listPostsInGroup(input: ListPostsInGroupInput): Promise<PostRow[]> {
  const { groupId, status = 'published', limit = 20, offset = 0 } = input;

  const rows = await db
    .select({
      id: posts.id,
      groupId: posts.groupId,
      authorId: posts.authorId,
      title: posts.title,
      body: posts.body,
      locale: posts.locale,
      status: posts.status,
      statusReason: posts.statusReason,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(and(eq(posts.groupId, groupId), eq(posts.status, status)))
    .orderBy(posts.createdAt)
    .limit(limit)
    .offset(offset);

  return rows as PostRow[];
}

export interface ListPostsForFeedInput {
  userId: string;
  sdgIds?: number[];
  limit?: number;
  offset?: number;
}

/**
 * List published posts for a user's feed.
 *
 * Joins through `group_members` to only return posts from groups the user
 * belongs to. Optionally narrows by SDG ids via `post_sdgs`.
 */
export async function listPostsForFeed(input: ListPostsForFeedInput): Promise<PostRow[]> {
  const { userId, sdgIds, limit = 20, offset = 0 } = input;

  // Build the subquery: post ids where author is in the user's groups
  const memberGroupIds = db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const conditions = [
    eq(posts.status, 'published'),
    inArray(posts.groupId, memberGroupIds),
  ] as const;

  if (sdgIds && sdgIds.length > 0) {
    // Filter posts that have at least one of the requested SDG ids
    const postIdsWithSdg = db
      .select({ postId: postSdgs.postId })
      .from(postSdgs)
      .where(inArray(postSdgs.sdgId, sdgIds));

    const rows = await db
      .select({
        id: posts.id,
        groupId: posts.groupId,
        authorId: posts.authorId,
        title: posts.title,
        body: posts.body,
        locale: posts.locale,
        status: posts.status,
        statusReason: posts.statusReason,
        publishedAt: posts.publishedAt,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(and(...conditions, inArray(posts.id, postIdsWithSdg)))
      .orderBy(posts.createdAt)
      .limit(limit)
      .offset(offset);

    return rows as PostRow[];
  }

  const rows = await db
    .select({
      id: posts.id,
      groupId: posts.groupId,
      authorId: posts.authorId,
      title: posts.title,
      body: posts.body,
      locale: posts.locale,
      status: posts.status,
      statusReason: posts.statusReason,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(and(...conditions))
    .orderBy(posts.createdAt)
    .limit(limit)
    .offset(offset);

  return rows as PostRow[];
}
