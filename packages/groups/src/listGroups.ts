import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups } from '@repo/database/schema';
import type { SdgId } from '@repo/sdg';
import { isSdgId } from '@repo/sdg';
import { and, count, countDistinct, eq, inArray } from 'drizzle-orm';
import type { CreatedGroup } from './createGroup.ts';

export interface ListGroupsInput {
  sdgIds?: number[];
  visibility?: 'public' | 'listed' | 'private';
  limit: number;
  offset: number;
}

export interface GroupRow extends CreatedGroup {
  memberCount: number;
  primarySdgId: SdgId;
}

export interface ListGroupsResult {
  rows: GroupRow[];
  total: number;
}

// Alias for the primary groupSdgs join
const primarySdgs = db
  .$with('primary_sdgs')
  .as(
    db
      .select({ groupId: groupSdgs.groupId, sdgId: groupSdgs.sdgId })
      .from(groupSdgs)
      .where(eq(groupSdgs.primary, true)),
  );

/**
 * Paginated, faceted browse of groups.
 *
 * Filters:
 *  - sdgIds: OR semantics — returns groups that have ANY of the given SDG ids.
 *  - visibility: exact match on the group_visibility enum.
 *
 * Returns { rows, total } where total is the unfiltered count for the same
 * WHERE conditions (for use in pagination UI).
 *
 * Each row includes memberCount (LEFT JOIN on group_members) and
 * primarySdgId (LEFT JOIN on group_sdgs where primary=true).
 */
export async function listGroups(input: ListGroupsInput): Promise<ListGroupsResult> {
  const { sdgIds, visibility, limit, offset } = input;

  // Build WHERE conditions incrementally
  const conditions = [];

  if (visibility !== undefined) {
    conditions.push(eq(groups.visibility, visibility));
  }

  if (sdgIds && sdgIds.length > 0) {
    // Use a subquery via inner join: only groups that have at least one
    // matching SDG row. inArray on groupSdgs then distinct on groups.id.
    const matchingGroupIds = await db
      .selectDistinct({ groupId: groupSdgs.groupId })
      .from(groupSdgs)
      .where(inArray(groupSdgs.sdgId, sdgIds));

    const ids = matchingGroupIds.map((r) => r.groupId);
    if (ids.length === 0) {
      return { rows: [], total: 0 };
    }

    conditions.push(inArray(groups.id, ids));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Parallel fetch: rows (with member count + primary SDG) + total count
  const [rows, countRows] = await Promise.all([
    db
      .with(primarySdgs)
      .select({
        id: groups.id,
        slug: groups.slug,
        name: groups.name,
        description: groups.description,
        visibility: groups.visibility,
        preferredLocale: groups.preferredLocale,
        locationText: groups.locationText,
        createdBy: groups.createdBy,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
        memberCount: count(groupMembers.userId),
        primarySdgId: primarySdgs.sdgId,
      })
      .from(groups)
      .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .leftJoin(primarySdgs, eq(primarySdgs.groupId, groups.id))
      .where(where)
      .groupBy(groups.id, primarySdgs.sdgId)
      .orderBy(groups.createdAt)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: countDistinct(groups.id) })
      .from(groups)
      .where(where),
  ]);

  const total = countRows[0]?.count ?? 0;

  // Normalise: primarySdgId may be null if the group_sdgs row is missing; fall back to 1.
  const normalisedRows: GroupRow[] = rows.map((r) => ({
    ...(r as Omit<typeof r, 'primarySdgId'>),
    primarySdgId: (isSdgId(r.primarySdgId) ? r.primarySdgId : 1) as SdgId,
  }));

  return { rows: normalisedRows, total };
}
