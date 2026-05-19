/**
 * member-suggestions task
 *
 * When a user joins or sets SDG interests, queries publicly available groups
 * whose SDG codes overlap with the user's interests and asks the provider to
 * rank them. Returns a GroupSuggestion list ready for notification fan-out.
 */

import { schema } from '@repo/database';
import { db } from '@repo/database/client';
import { and, eq, inArray, notExists } from 'drizzle-orm';
import type { CommunityAgentProvider, SuggestGroupsInput } from '../provider.ts';
import type { GroupSuggestion } from '../types.ts';

export interface MemberSuggestionsTaskInput {
  readonly userId: string;
  /** Max number of suggestions to return. Default: 5. */
  readonly maxSuggestions?: number;
}

interface GroupRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  sdgCodes: string[];
}

async function fetchUserSdgCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ sdgId: schema.followedSdgs.sdgId })
    .from(schema.followedSdgs)
    .where(eq(schema.followedSdgs.userId, userId));
  return rows.map((r) => `SDG${r.sdgId}`);
}

async function fetchCandidateGroups(userId: string, userSdgIds: number[]): Promise<GroupRow[]> {
  if (userSdgIds.length === 0) {
    // No SDG interests — return top public groups as fallback
    const rows = await db
      .select({
        id: schema.groups.id,
        slug: schema.groups.slug,
        name: schema.groups.name,
        description: schema.groups.description,
      })
      .from(schema.groups)
      .where(
        and(
          eq(schema.groups.visibility, 'public'),
          notExists(
            db
              .select()
              .from(schema.groupMembers)
              .where(
                and(
                  eq(schema.groupMembers.groupId, schema.groups.id),
                  eq(schema.groupMembers.userId, userId),
                ),
              ),
          ),
        ),
      )
      .limit(20);

    return rows.map((r) => ({ ...r, sdgCodes: [] }));
  }

  // Groups that share at least one SDG with the user and the user hasn't joined
  const rows = await db
    .selectDistinct({
      id: schema.groups.id,
      slug: schema.groups.slug,
      name: schema.groups.name,
      description: schema.groups.description,
    })
    .from(schema.groups)
    .innerJoin(schema.groupSdgs, eq(schema.groupSdgs.groupId, schema.groups.id))
    .where(
      and(
        eq(schema.groups.visibility, 'public'),
        inArray(schema.groupSdgs.sdgId, userSdgIds),
        notExists(
          db
            .select()
            .from(schema.groupMembers)
            .where(
              and(
                eq(schema.groupMembers.groupId, schema.groups.id),
                eq(schema.groupMembers.userId, userId),
              ),
            ),
        ),
      ),
    )
    .limit(30);

  if (rows.length === 0) return [];

  const groupIds = rows.map((r) => r.id);
  const sdgRows = await db
    .select({ groupId: schema.groupSdgs.groupId, sdgId: schema.groupSdgs.sdgId })
    .from(schema.groupSdgs)
    .where(inArray(schema.groupSdgs.groupId, groupIds));

  const sdgMap = new Map<string, string[]>();
  for (const row of sdgRows) {
    const existing = sdgMap.get(row.groupId) ?? [];
    existing.push(`SDG${row.sdgId}`);
    sdgMap.set(row.groupId, existing);
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    sdgCodes: sdgMap.get(r.id) ?? [],
  }));
}

export async function runMemberSuggestionsTask(
  provider: CommunityAgentProvider,
  input: MemberSuggestionsTaskInput,
): Promise<readonly GroupSuggestion[]> {
  const userSdgCodes = await fetchUserSdgCodes(input.userId);
  const userSdgIds = userSdgCodes
    .map((c) => Number.parseInt(c.replace('SDG', ''), 10))
    .filter((n) => !Number.isNaN(n));

  const candidateGroups = await fetchCandidateGroups(input.userId, userSdgIds);

  if (candidateGroups.length === 0) return [];

  const providerInput: SuggestGroupsInput = {
    userId: input.userId,
    userSdgCodes,
    candidateGroups,
    maxSuggestions: input.maxSuggestions ?? 5,
  };

  return provider.suggestGroupsForUser(providerInput);
}
