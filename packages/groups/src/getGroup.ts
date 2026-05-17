import { db } from '@repo/database/client';
import { groupSdgs, groups } from '@repo/database/schema';
import { getSdgById, isSdgId } from '@repo/sdg';
import type { Sdg } from '@repo/sdg';
import { eq, sql } from 'drizzle-orm';
import type { CreatedGroup } from './createGroup.ts';

export interface GroupWithSdgs extends CreatedGroup {
  sdgs: Sdg[];
}

/**
 * Fetch a group by its slug (case-insensitive), joined with its SDG metadata.
 * Returns null if no group with the given slug exists.
 */
export async function getGroupBySlug(slug: string): Promise<GroupWithSdgs | null> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(sql`lower(${groups.slug}) = lower(${slug})`)
    .limit(1);

  const group = groupRows[0];
  if (!group) return null;

  const sdgRows = await db
    .select({ sdgId: groupSdgs.sdgId })
    .from(groupSdgs)
    .where(eq(groupSdgs.groupId, group.id));

  const sdgs: Sdg[] = sdgRows
    .filter((r) => isSdgId(r.sdgId))
    .map((r) => getSdgById(r.sdgId as Parameters<typeof getSdgById>[0]));

  return {
    ...(group as CreatedGroup),
    sdgs,
  };
}
