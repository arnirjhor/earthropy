/**
 * weekly-digest task
 *
 * Fetches published posts from the past week for a given group, calls the
 * provider to draft digest content, and returns the DigestContent for the
 * caller to render into an email and fan out to opted-in members.
 */

import { schema } from '@repo/database';
import { db } from '@repo/database/client';
import { and, between, eq, inArray } from 'drizzle-orm';
import type { CommunityAgentProvider, DraftDigestInput } from '../provider.ts';
import type { CandidatePost, DigestContent } from '../types.ts';

export interface WeeklyDigestTaskInput {
  readonly groupId: string;
  /** Override period end; defaults to now. */
  readonly periodEnd?: Date;
}

interface GroupRow {
  id: string;
  name: string;
}

async function fetchGroupById(groupId: string): Promise<GroupRow | undefined> {
  const rows = await db
    .select({ id: schema.groups.id, name: schema.groups.name })
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1);
  return rows[0];
}

async function fetchWeeklyPosts(
  groupId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CandidatePost[]> {
  const rows = await db
    .select({
      id: schema.posts.id,
      title: schema.posts.title,
      authorId: schema.posts.authorId,
      publishedAt: schema.posts.publishedAt,
      body: schema.posts.body,
    })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.groupId, groupId),
        eq(schema.posts.status, 'published'),
        between(schema.posts.publishedAt, periodStart, periodEnd),
      ),
    )
    .orderBy(schema.posts.publishedAt)
    .limit(20);

  if (rows.length === 0) return [];

  // Fetch author handles
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authorRows = await db
    .select({ id: schema.users.id, handle: schema.users.handle })
    .from(schema.users)
    .where(inArray(schema.users.id, authorIds));
  const authorMap = new Map(authorRows.map((a) => [a.id, a.handle]));

  // Fetch SDG codes per post
  const postIds = rows.map((r) => r.id);
  const sdgRows = await db
    .select({ postId: schema.postSdgs.postId, sdgId: schema.postSdgs.sdgId })
    .from(schema.postSdgs)
    .where(inArray(schema.postSdgs.postId, postIds));

  const sdgMap = new Map<string, string[]>();
  for (const row of sdgRows) {
    const existing = sdgMap.get(row.postId) ?? [];
    existing.push(`SDG${row.sdgId}`);
    sdgMap.set(row.postId, existing);
  }

  return rows
    .filter((r) => r.publishedAt !== null)
    .map((r) => ({
      id: r.id,
      title: r.title,
      authorHandle: authorMap.get(r.authorId) ?? r.authorId,
      publishedAt: r.publishedAt as Date,
      sdgCodes: sdgMap.get(r.id) ?? [],
      body: r.body,
    }));
}

export async function runWeeklyDigestTask(
  provider: CommunityAgentProvider,
  input: WeeklyDigestTaskInput,
): Promise<DigestContent | null> {
  const periodEnd = input.periodEnd ?? new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const group = await fetchGroupById(input.groupId);
  if (!group) return null;

  const posts = await fetchWeeklyPosts(input.groupId, periodStart, periodEnd);

  const providerInput: DraftDigestInput = {
    groupId: group.id,
    groupName: group.name,
    period: 'weekly',
    periodStart,
    periodEnd,
    posts,
  };

  return provider.draftDigest(providerInput);
}
