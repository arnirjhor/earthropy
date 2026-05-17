import { db } from '@repo/database/client';
import { groupSdgs, groups } from '@repo/database/schema';
import { and, countDistinct, eq, inArray } from 'drizzle-orm';
import type { CreatedGroup } from './createGroup.ts';

export interface ListGroupsInput {
  sdgIds?: number[];
  visibility?: 'public' | 'listed' | 'private';
  limit: number;
  offset: number;
}

export interface ListGroupsResult {
  rows: CreatedGroup[];
  total: number;
}

/**
 * Paginated, faceted browse of groups.
 *
 * Filters:
 *  - sdgIds: OR semantics — returns groups that have ANY of the given SDG ids.
 *  - visibility: exact match on the group_visibility enum.
 *
 * Returns { rows, total } where total is the unfiltered count for the same
 * WHERE conditions (for use in pagination UI).
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

  // Parallel fetch: rows + total count
  const [rows, countRows] = await Promise.all([
    db.select().from(groups).where(where).orderBy(groups.createdAt).limit(limit).offset(offset),
    db
      .select({ count: countDistinct(groups.id) })
      .from(groups)
      .where(where),
  ]);

  const total = countRows[0]?.count ?? 0;

  return { rows: rows as CreatedGroup[], total };
}
