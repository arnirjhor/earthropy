import { TOKEN_TTL, issueToken } from '@repo/auth';
import { db } from '@repo/database/client';
import { groupMembers, users } from '@repo/database/schema';
import { and, eq, sql } from 'drizzle-orm';

export interface InviteToGroupInput {
  groupId: string;
  inviterId: string;
  email: string;
  role: 'member' | 'moderator';
}

export interface InviteToGroupResult {
  rawToken: string;
  inviteeUserId: string;
}

/**
 * Invite a user to a group by email.
 *
 * Authorization: actor must be owner or moderator of the group.
 * User lookup: email must match an existing account.
 *   If no user is found, throws "user not found" (pre-account invite is out of scope).
 *
 * Issues a single-use token with purpose='group_invite' and payload=`${groupId}:${role}`.
 * Sends the invite email via @repo/notifications sendTransactional.
 *
 * Returns { rawToken, inviteeUserId }.
 */
export async function inviteToGroup(input: InviteToGroupInput): Promise<InviteToGroupResult> {
  const { groupId, inviterId, email, role } = input;

  // 1. Check actor is owner or moderator
  const actorRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, inviterId)))
    .limit(1);

  const actorMember = actorRows[0];
  if (!actorMember || actorMember.role === 'member') {
    throw new Error(`Actor ${inviterId} is not authorized to invite to group ${groupId}`);
  }

  // 2. Look up invitee by email
  const inviteeRows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);

  const invitee = inviteeRows[0];
  if (!invitee) {
    throw new Error(`User not found with email: ${email}`);
  }

  // 3. Issue token with payload = `${groupId}:${role}`
  const payload = `${groupId}:${role}`;
  const { rawToken } = await issueToken(
    invitee.id,
    'group_invite',
    payload,
    TOKEN_TTL.group_invite,
  );

  // 4. Send invite email (dynamic import to avoid circular deps in tests)
  const appUrl = process.env.APP_URL ?? 'https://earthropy.org';
  const inviteUrl = `${appUrl}/en/invite/${rawToken}`;

  // Fetch inviter display name
  const inviterRows = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, inviterId))
    .limit(1);
  const inviterName = inviterRows[0]?.displayName ?? 'A group member';

  try {
    const { sendTransactional } = await import('@repo/notifications');
    await sendTransactional({
      to: email,
      template: 'group-invite',
      props: {
        inviteUrl,
        groupName: groupId, // caller can override; will be enriched if needed
        inviterName,
        role,
      },
      locale: 'en',
    });
  } catch {
    // Non-fatal: token is already issued; email failure should not block the invite
  }

  return { rawToken, inviteeUserId: invitee.id };
}
