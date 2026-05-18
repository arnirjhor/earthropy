import { hashToken } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, tokens } from '@repo/database/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Revoke a pending group invite token.
 *
 * actorId must be an owner or moderator of the group that the token belongs to.
 * The group is inferred from the token's payload.
 *
 * tokenId: the raw token (not hashed); we hash it here to look up in the DB.
 *
 * Throws if actor is not authorized or the token is not found / not a group_invite.
 */
export async function revokeInvite(rawToken: string, actorId: string): Promise<void> {
  const hashed = hashToken(rawToken);

  // Fetch the token row to extract the groupId from payload
  const tokenRows = await db
    .select({ userId: tokens.userId, payload: tokens.payload, purpose: tokens.purpose })
    .from(tokens)
    .where(eq(tokens.id, hashed))
    .limit(1);

  const tokenRow = tokenRows[0];
  if (!tokenRow || tokenRow.purpose !== 'group_invite') {
    throw new Error('Token not found or not a group invite');
  }

  const payload = tokenRow.payload ?? '';
  const colonIdx = payload.lastIndexOf(':');
  if (colonIdx === -1) {
    throw new Error('Malformed invite token payload');
  }
  const groupId = payload.slice(0, colonIdx);

  // Check actor authorization
  const actorRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actorId)))
    .limit(1);

  const actorMember = actorRows[0];
  if (!actorMember || actorMember.role === 'member') {
    throw new Error(`Actor ${actorId} is not authorized to revoke invites for group ${groupId}`);
  }

  // Delete the token
  await db.delete(tokens).where(eq(tokens.id, hashed));
}
