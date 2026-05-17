'use server';

/**
 * Server Actions for the moderator queue.
 *
 * Each action:
 * 1. Resolves the authenticated viewer.
 * 2. Verifies moderation authority (group owner/moderator or platform anchor ≥2000 rep).
 * 3. Inserts an immutable moderation_decisions row.
 * 4. Transitions the content status.
 */

import { getSession } from '@repo/auth';
import { updateCommentStatus } from '@repo/comments';
import { db } from '@repo/database/client';
import { comments, groupMembers, moderationDecisions, posts } from '@repo/database/schema';
import { updatePostStatus } from '@repo/posts';
import { can } from '@repo/trust';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TargetType = 'post' | 'comment';

export class NotAuthorizedError extends Error {
  constructor() {
    super('You do not have moderation authority for this item.');
    this.name = 'NotAuthorizedError';
  }
}

// ── Auth helper ────────────────────────────────────────────────────────────────

async function requireModerator() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) throw new NotAuthorizedError();

  const user = await getSession(sessionId);
  if (!user) throw new NotAuthorizedError();

  return user;
}

// ── Authority check ────────────────────────────────────────────────────────────

/**
 * Returns true if the user has authority to moderate the given target.
 *
 * Authority rules:
 * - Platform anchor (reputation ≥ 2000): can moderate everything.
 * - Group owner/moderator: can moderate items in their group.
 */
async function hasModerationAuthority(
  userId: string,
  reputation: number,
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  // Platform anchors can moderate all pending items.
  if (reputation >= 2000) return true;

  // Resolve the group for the target.
  let groupId: string | null = null;

  if (targetType === 'post') {
    const rows = await db
      .select({ groupId: posts.groupId })
      .from(posts)
      .where(eq(posts.id, targetId))
      .limit(1);
    groupId = rows[0]?.groupId ?? null;
  } else {
    // comment → post → group
    const rows = await db
      .select({ postId: comments.postId })
      .from(comments)
      .where(eq(comments.id, targetId))
      .limit(1);
    const postId = rows[0]?.postId ?? null;
    if (postId) {
      const postRows = await db
        .select({ groupId: posts.groupId })
        .from(posts)
        .where(eq(posts.id, postId))
        .limit(1);
      groupId = postRows[0]?.groupId ?? null;
    }
  }

  if (!groupId) return false;

  // Check the viewer's own membership in this specific group.
  const viewerRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))
    .limit(50);

  const viewerMembership = viewerRows.find((r) =>
    can('group.moderate', reputation, { groupRole: r.role as 'owner' | 'moderator' | 'member' }),
  );

  return !!viewerMembership;
}

// ── Publish action ─────────────────────────────────────────────────────────────

export async function moderatorPublishAction(
  targetType: TargetType,
  targetId: string,
  reason?: string,
): Promise<{ ok: true }> {
  const user = await requireModerator();

  const authorized = await hasModerationAuthority(user.id, user.reputation, targetType, targetId);
  if (!authorized) throw new NotAuthorizedError();

  // Write immutable audit row first.
  await db.insert(moderationDecisions).values({
    targetType,
    targetId,
    provider: 'human',
    model: 'manual',
    scores: {},
    verdict: 'human_publish',
    reasoning: reason ?? null,
    reviewerId: user.id,
  });

  // Transition status.
  if (targetType === 'post') {
    await updatePostStatus(targetId, {
      newStatus: 'published',
      reason,
      actorId: user.id,
    });
  } else {
    await updateCommentStatus(targetId, {
      newStatus: 'published',
      reason,
      actorId: user.id,
    });
  }

  revalidatePath('/[locale]/(authenticated)/moderation', 'page');
  return { ok: true };
}

// ── Reject action ──────────────────────────────────────────────────────────────

export async function moderatorRejectAction(
  targetType: TargetType,
  targetId: string,
  reason: string,
): Promise<{ ok: true }> {
  const user = await requireModerator();

  const authorized = await hasModerationAuthority(user.id, user.reputation, targetType, targetId);
  if (!authorized) throw new NotAuthorizedError();

  // Write immutable audit row first.
  await db.insert(moderationDecisions).values({
    targetType,
    targetId,
    provider: 'human',
    model: 'manual',
    scores: {},
    verdict: 'human_reject',
    reasoning: reason,
    reviewerId: user.id,
  });

  // Transition status.
  if (targetType === 'post') {
    await updatePostStatus(targetId, {
      newStatus: 'rejected',
      reason,
      actorId: user.id,
    });
  } else {
    await updateCommentStatus(targetId, {
      newStatus: 'rejected',
      reason,
      actorId: user.id,
    });
  }

  revalidatePath('/[locale]/(authenticated)/moderation', 'page');
  return { ok: true };
}
