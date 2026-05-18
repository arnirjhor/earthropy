import { db } from '@repo/database/client';
import { groupMembers } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Change the role of a group member.
 *
 * Authorization rules:
 *   - Only the owner can change roles.
 *   - The new role cannot be 'owner' — use transferOwnership for that.
 *   - Target user must already be a member.
 *
 * Throws:
 *   - Error(/not authorized/i) if actor is not the owner.
 *   - Error(/use transferOwnership/i) if newRole is 'owner'.
 *   - Error(/not a member/i) if target is not a group member.
 */
export async function setMemberRole(
  groupId: string,
  userId: string,
  newRole: 'member' | 'moderator',
  actorId: string,
): Promise<void> {
  if ((newRole as string) === 'owner') {
    throw new Error('Cannot set role to owner directly — use transferOwnership instead');
  }

  // Check actor is the owner
  const actorRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actorId)))
    .limit(1);

  const actorMember = actorRows[0];
  if (!actorMember || actorMember.role !== 'owner') {
    throw new Error(`Actor ${actorId} is not authorized to change roles in group ${groupId}`);
  }

  // Check target is a member
  const targetRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (!targetRows[0]) {
    throw new Error(`User ${userId} is not a member of group ${groupId}`);
  }

  // Update the role
  await db
    .update(groupMembers)
    .set({ role: newRole })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}
