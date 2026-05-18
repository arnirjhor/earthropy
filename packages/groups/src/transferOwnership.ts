import { db } from '@repo/database/client';
import { groupMembers } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Transfer ownership of a group from actorId to newOwnerId.
 *
 * Atomically:
 *   1. Sets newOwnerId's role to 'owner' (upsert if not yet a member).
 *   2. Demotes actorId from 'owner' to 'member'.
 *
 * Authorization: actorId must be the current owner.
 *
 * Throws:
 *   - Error(/not authorized/i) if actor is not the owner.
 *   - Error(/cannot transfer to yourself/i) if newOwnerId === actorId.
 */
export async function transferOwnership(
  groupId: string,
  newOwnerId: string,
  actorId: string,
): Promise<void> {
  if (newOwnerId === actorId) {
    throw new Error('Cannot transfer to yourself');
  }

  // Verify actor is owner
  const actorRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actorId)))
    .limit(1);

  const actorMember = actorRows[0];
  if (!actorMember || actorMember.role !== 'owner') {
    throw new Error(`Actor ${actorId} is not authorized to transfer ownership of group ${groupId}`);
  }

  await db.transaction(async (tx) => {
    // Upsert new owner row
    await tx
      .insert(groupMembers)
      .values({ groupId, userId: newOwnerId, role: 'owner' })
      .onConflictDoUpdate({
        target: [groupMembers.groupId, groupMembers.userId],
        set: { role: 'owner' },
      });

    // Demote old owner to member
    await tx
      .update(groupMembers)
      .set({ role: 'member' })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actorId)));
  });
}
