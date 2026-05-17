import { db } from '@repo/database/client';
import { groupMembers, groupSdgs, groups } from '@repo/database/schema';
import { isSdgId } from '@repo/sdg';
import type { SdgId } from '@repo/sdg';
import { sql } from 'drizzle-orm';
import { toSlug, withCollisionSuffix } from './slug.ts';

export interface CreateGroupInput {
  name: string;
  /** Optional slug override; if omitted the slug is derived from `name` via `toSlug`. */
  slug?: string;
  description: string;
  primarySdgId: SdgId;
  additionalSdgIds: SdgId[];
  visibility: 'public' | 'listed' | 'private';
  preferredLocale: string;
  locationText: string | null;
  createdBy: string;
}

export interface CreatedGroup {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'listed' | 'private';
  preferredLocale: string;
  locationText: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new group.
 *
 * - Validates SDG ids via @repo/sdg.
 * - Rejects if primarySdgId appears in additionalSdgIds.
 * - Generates a collision-free slug from the name.
 * - Wraps all inserts (groups, group_sdgs, group_members) in a single transaction.
 * - Inserts exactly one group_sdgs row with primary=true (for primarySdgId).
 * - Auto-inserts the creator as a group_members row with role='owner'.
 */
export async function createGroup(input: CreateGroupInput): Promise<CreatedGroup> {
  const {
    name,
    slug: slugOverride,
    description,
    primarySdgId,
    additionalSdgIds,
    visibility,
    preferredLocale,
    locationText,
    createdBy,
  } = input;

  // Validate SDG ids
  if (!isSdgId(primarySdgId)) {
    throw new Error(`Invalid SDG id: ${String(primarySdgId)}`);
  }
  for (const id of additionalSdgIds) {
    if (!isSdgId(id)) {
      throw new Error(`Invalid SDG id: ${String(id)}`);
    }
  }

  // Enforce uniqueness: primarySdgId must not appear in additionalSdgIds
  if (additionalSdgIds.includes(primarySdgId)) {
    throw new Error(
      `Duplicate SDG id: ${primarySdgId} appears in both primarySdgId and additionalSdgIds`,
    );
  }

  // Generate collision-free slug: use the override if provided, otherwise derive from name.
  const baseSlug =
    slugOverride && slugOverride.trim().length > 0 ? toSlug(slugOverride) : toSlug(name);
  const slug = await withCollisionSuffix(baseSlug, async (candidate) => {
    const rows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(sql`lower(${groups.slug}) = lower(${candidate})`)
      .limit(1);
    return rows.length > 0;
  });

  // Run all inserts in one transaction
  const result = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({
        slug,
        name,
        description,
        visibility,
        preferredLocale,
        locationText,
        createdBy,
      })
      .returning();

    if (!group) throw new Error('Group insert returned no rows');

    // Insert primary SDG row
    await tx.insert(groupSdgs).values({
      groupId: group.id,
      sdgId: primarySdgId,
      primary: true,
    });

    // Insert additional SDG rows (non-primary)
    if (additionalSdgIds.length > 0) {
      await tx.insert(groupSdgs).values(
        additionalSdgIds.map((sdgId) => ({
          groupId: group.id,
          sdgId,
          primary: false,
        })),
      );
    }

    // Auto-insert creator as owner member
    await tx.insert(groupMembers).values({
      groupId: group.id,
      userId: createdBy,
      role: 'owner',
    });

    return group;
  });

  return result as CreatedGroup;
}
