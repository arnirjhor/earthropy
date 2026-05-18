import { consumeToken } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers } from '@repo/database/schema';

export interface ClaimInviteResult {
  groupId: string;
  role: 'member' | 'moderator';
}

/**
 * Claim a group invite token.
 *
 * Atomically consumes the token (DELETE … RETURNING) and inserts a
 * group_members row for the claiming user.
 *
 * The token must:
 *   - have purpose='group_invite'
 *   - be unexpired
 *   - belong to userId (i.e. the token was issued for this user)
 *
 * Token payload format: `${groupId}:${role}` (e.g. `"uuid-here:member"`).
 *
 * Throws "Invalid or expired invite token" if the token cannot be consumed.
 */
export async function claimInvite(rawToken: string, userId: string): Promise<ClaimInviteResult> {
  // consumeToken is atomic delete-on-read; returns null if wrong user/expired/already consumed
  const consumed = await consumeToken(rawToken, 'group_invite');
  if (!consumed || consumed.userId !== userId) {
    throw new Error('Invalid or expired invite token');
  }

  const payload = consumed.payload ?? '';
  const colonIdx = payload.lastIndexOf(':');
  if (colonIdx === -1) {
    throw new Error('Malformed invite token payload');
  }

  const groupId = payload.slice(0, colonIdx);
  const rawRole = payload.slice(colonIdx + 1);
  const role: 'member' | 'moderator' = rawRole === 'moderator' ? 'moderator' : 'member';

  // Insert membership row (upsert: if already a member, keep existing row)
  await db.insert(groupMembers).values({ groupId, userId, role }).onConflictDoNothing();

  return { groupId, role };
}
