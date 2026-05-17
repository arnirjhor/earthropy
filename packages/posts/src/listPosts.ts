import { db } from '@repo/database/client';
import { groupMembers, postSdgs, posts } from '@repo/database/schema';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

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
  /**
   * When provided, posts tagged with ANY of these SDG ids are included in
   * the feed alongside posts from the user's groups (OR union — deduped by
   * Postgres). Matches the `user_followed_sdgs` pattern.
   */
  sdgIds?: number[];
  limit?: number;
  offset?: number;
}

/**
 * List published posts for a user's personalised feed.
 *
 * Returns the union of:
 *   A) posts from groups the user is a member of
 *   B) posts tagged with any of the user's followed SDGs (when sdgIds provided)
 *
 * Results are ordered by published_at desc (most recent first), capped at
 * `limit` (default 25).
 */
export async function listPostsForFeed(input: ListPostsForFeedInput): Promise<PostRow[]> {
  const { userId, sdgIds, limit = 25, offset = 0 } = input;

  // Subquery A: group ids the user belongs to
  const memberGroupIds = db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const fromGroupsCondition = inArray(posts.groupId, memberGroupIds);

  const postColumns = {
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
  } as const;

  if (sdgIds && sdgIds.length > 0) {
    // Subquery B: post ids tagged with any followed SDG
    const postIdsWithSdg = db
      .select({ postId: postSdgs.postId })
      .from(postSdgs)
      .where(inArray(postSdgs.sdgId, sdgIds));

    const rows = await db
      .select(postColumns)
      .from(posts)
      .where(
        and(
          eq(posts.status, 'published'),
          or(fromGroupsCondition, inArray(posts.id, postIdsWithSdg)),
        ),
      )
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset);

    return rows as PostRow[];
  }

  const rows = await db
    .select(postColumns)
    .from(posts)
    .where(and(eq(posts.status, 'published'), fromGroupsCondition))
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);

  return rows as PostRow[];
}
