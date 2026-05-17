import { db } from '@repo/database/client';
import { groupMembers, groups } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';
import type { CreatedGroup } from './createGroup.ts';

export interface UpdateGroupFields {
  name?: string;
  description?: string;
  visibility?: 'public' | 'listed' | 'private';
  preferredLocale?: string;
  locationText?: string | null;
}

export interface UpdateGroupOpts {
  actorId: string;
}

/**
 * Update mutable fields of a group.
 *
 * Authorization rules:
 *  - Actor must be a member with role 'owner' or 'moderator'.
 *  - Plain 'member' role is rejected.
 *  - Non-members are rejected.
 *
 * Soft-close convention:
 *  - Setting visibility='private' is the soft-close operation (the schema has
 *    no closed_at column; 'private' is the canonical closed state).
 *  - Mutations on already-private (closed) groups are rejected. This prevents
 *    accidental edits after closure. To re-open, a separate escalation path
 *    (admin action) is needed — out of scope for B-GROUP-1.
 *
 * Throws:
 *  - Error(/not authorized/i) for auth failures.
 *  - Error(/closed/i) when the group is already private and a non-visibility
 *    mutation is attempted.
 */
export async function updateGroup(
  id: string,
  fields: UpdateGroupFields,
  opts: UpdateGroupOpts,
): Promise<CreatedGroup> {
  const { actorId } = opts;

  // Fetch the group
  const groupRows = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  const group = groupRows[0];
  if (!group) throw new Error(`Group not found: ${id}`);

  // Block mutations on private (soft-closed) groups
  if (group.visibility === 'private') {
    throw new Error('Group is closed (visibility=private) and cannot be mutated');
  }

  // Check actor role
  const memberRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, actorId)))
    .limit(1);

  const member = memberRows[0];
  if (!member) {
    throw new Error(`Actor ${actorId} is not authorized to update group ${id}`);
  }
  if (member.role === 'member') {
    throw new Error(`Actor ${actorId} is not authorized to update group ${id} (role: member)`);
  }

  // Apply update
  const now = new Date();
  const [updated] = await db
    .update(groups)
    .set({ ...fields, updatedAt: now })
    .where(eq(groups.id, id))
    .returning();

  if (!updated) throw new Error(`Update returned no rows for group ${id}`);

  return updated as CreatedGroup;
}
