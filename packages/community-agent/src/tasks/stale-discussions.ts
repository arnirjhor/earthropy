/**
 * stale-discussions task
 *
 * Queries the database for posts with no activity in N days within a group,
 * calls the provider to generate re-engagement suggestions, and returns the
 * enriched StaleDiscussion list for the caller to act on (e.g. notify admins).
 */

import { schema } from '@repo/database';
import { db } from '@repo/database/client';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { CommunityAgentProvider, FindStaleDiscussionsInput } from '../provider.ts';
import type { StaleDiscussion } from '../types.ts';

export interface StaleDiscussionsTaskInput {
  readonly groupId: string;
  /** Days of inactivity before a post is considered stale. */
  readonly staleDays: number;
  /** Max posts to surface in one run. Default: 10. */
  readonly maxPosts?: number;
}

interface PostRow {
  id: string;
  title: string;
  authorId: string;
  updatedAt: Date;
  sdgCodes: string[];
}

async function fetchStalePosts(
  groupId: string,
  staleDays: number,
  maxPosts: number,
): Promise<PostRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const rows = await db
    .select({
      id: schema.posts.id,
      title: schema.posts.title,
      authorId: schema.posts.authorId,
      updatedAt: schema.posts.updatedAt,
    })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.groupId, groupId),
        eq(schema.posts.status, 'published'),
        lt(schema.posts.updatedAt, cutoff),
      ),
    )
    .orderBy(schema.posts.updatedAt)
    .limit(maxPosts);

  if (rows.length === 0) return [];

  // Fetch SDG codes per post
  const postIds = rows.map((r) => r.id);
  const sdgRows = await db
    .select({ postId: schema.postSdgs.postId, sdgId: schema.postSdgs.sdgId })
    .from(schema.postSdgs)
    .where(sql`${schema.postSdgs.postId} = ANY(${postIds})`);

  const sdgMap = new Map<string, string[]>();
  for (const row of sdgRows) {
    const existing = sdgMap.get(row.postId) ?? [];
    existing.push(`SDG${row.sdgId}`);
    sdgMap.set(row.postId, existing);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    authorId: r.authorId,
    updatedAt: r.updatedAt,
    sdgCodes: sdgMap.get(r.id) ?? [],
  }));
}

export async function runStaleDiscussionsTask(
  provider: CommunityAgentProvider,
  input: StaleDiscussionsTaskInput,
): Promise<readonly StaleDiscussion[]> {
  const maxPosts = input.maxPosts ?? 10;
  const posts = await fetchStalePosts(input.groupId, input.staleDays, maxPosts);

  if (posts.length === 0) return [];

  const now = new Date();
  const providerInput: FindStaleDiscussionsInput = {
    groupId: input.groupId,
    staleDays: input.staleDays,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      authorId: p.authorId,
      lastActivityAt: p.updatedAt,
      daysSinceActivity: Math.floor(
        (now.getTime() - p.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      ),
      sdgCodes: p.sdgCodes,
    })),
  };

  return provider.findStaleDiscussions(providerInput);
}
