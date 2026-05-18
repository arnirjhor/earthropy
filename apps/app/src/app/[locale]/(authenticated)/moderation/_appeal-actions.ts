'use server';

/**
 * Server Actions for appeal submission and resolution.
 *
 * Each action:
 * 1. Resolves the authenticated viewer.
 * 2. Verifies authorization (author for submit; moderator for resolve).
 * 3. Performs the appropriate database writes.
 * 4. Fires side effects (reputation event + notification on resolution).
 */

import { getSession } from '@repo/auth';
import { updateCommentStatus } from '@repo/comments';
import { db } from '@repo/database/client';
import { appeals, comments, groupMembers, moderationDecisions, posts } from '@repo/database/schema';
import { notify } from '@repo/notifications';
import { updatePostStatus } from '@repo/posts';
import { can, recordEvent } from '@repo/trust';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TargetType = 'post' | 'comment';

export type ActionError = { ok: false; error: string };
export type ActionOk<T> = { ok: true; data: T };
export type ActionResult<T> = ActionOk<T> | ActionError;

export interface SubmitAppealInput {
  targetType: TargetType;
  targetId: string;
  message: string;
}

export interface ResolveAppealInput {
  appealId: string;
  resolution: 'upheld' | 'rejected';
  resolutionMessage?: string;
}

// ── Auth helpers ───────────────────────────────────────────────────────────────

async function requireSession() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── Authority helpers ──────────────────────────────────────────────────────────

async function getGroupIdForTarget(
  targetType: TargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === 'post') {
    const rows = await db
      .select({ groupId: posts.groupId })
      .from(posts)
      .where(eq(posts.id, targetId))
      .limit(1);
    return rows[0]?.groupId ?? null;
  }

  // comment → post → group
  const commentRows = await db
    .select({ postId: comments.postId })
    .from(comments)
    .where(eq(comments.id, targetId))
    .limit(1);

  const postId = commentRows[0]?.postId ?? null;
  if (!postId) return null;

  const postRows = await db
    .select({ groupId: posts.groupId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  return postRows[0]?.groupId ?? null;
}

async function hasModerationAuthority(
  userId: string,
  reputation: number,
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  if (reputation >= 2000) return true;

  const groupId = await getGroupIdForTarget(targetType, targetId);
  if (!groupId) return false;

  const memberRows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))
    .limit(50);

  return memberRows.some((r) =>
    can('group.moderate', reputation, { groupRole: r.role as 'owner' | 'moderator' | 'member' }),
  );
}

async function getAuthorIdForTarget(
  targetType: TargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === 'post') {
    const rows = await db
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, targetId))
      .limit(1);
    return rows[0]?.authorId ?? null;
  }

  const rows = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(eq(comments.id, targetId))
    .limit(1);
  return rows[0]?.authorId ?? null;
}

// ── submitAppealAction ─────────────────────────────────────────────────────────

/**
 * File an appeal for a rejected post or comment.
 *
 * Author-only. Rate-limited to one appeal per target (existing appeal check).
 */
export async function submitAppealAction(
  input: SubmitAppealInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { targetType, targetId, message } = input;

  // Verify caller is the author.
  const authorId = await getAuthorIdForTarget(targetType, targetId);
  if (authorId !== user.id) {
    return { ok: false, error: 'not_author' };
  }

  // One-appeal-per-content rate limit: check for existing unresolved appeal.
  const existing = await db
    .select({ id: appeals.id })
    .from(appeals)
    .where(
      and(
        eq(appeals.targetType, targetType),
        eq(appeals.targetId, targetId),
        eq(appeals.userId, user.id),
        isNull(appeals.resolvedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { ok: false, error: 'already_appealed' };
  }

  const [inserted] = await db
    .insert(appeals)
    .values({
      targetType,
      targetId,
      userId: user.id,
      message: message.trim(),
    })
    .returning({ id: appeals.id });

  if (!inserted) {
    return { ok: false, error: 'insert_failed' };
  }

  revalidatePath('/[locale]/(authenticated)/moderation/appeals', 'page');
  return { ok: true, data: { id: inserted.id } };
}

// ── resolveAppealAction ────────────────────────────────────────────────────────

/**
 * Resolve an appeal as upheld or rejected.
 *
 * Moderator/anchor only.
 *
 * Upheld:
 *   - Writes a moderation_decisions row (verdict='human_publish').
 *   - Transitions target to 'published'.
 *   - Records appeal_resolved_for_user reputation event for the appeal author.
 *
 * Rejected:
 *   - Writes a moderation_decisions row (verdict='human_reject').
 *   - Status stays 'rejected'. No reputation impact.
 *
 * Both: updates the appeal row (resolution, resolvedBy, resolvedAt) + notifies the author.
 */
export async function resolveAppealAction(
  input: ResolveAppealInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { appealId, resolution, resolutionMessage } = input;

  // Fetch the appeal.
  const appealRows = await db
    .select({
      id: appeals.id,
      targetType: appeals.targetType,
      targetId: appeals.targetId,
      userId: appeals.userId,
      resolvedAt: appeals.resolvedAt,
    })
    .from(appeals)
    .where(eq(appeals.id, appealId))
    .limit(1);

  const appeal = appealRows[0];
  if (!appeal) return { ok: false, error: 'not_found' };
  if (appeal.resolvedAt !== null) return { ok: false, error: 'already_resolved' };

  // Verify moderation authority over the target.
  const targetType = appeal.targetType as TargetType;
  const authorized = await hasModerationAuthority(
    user.id,
    user.reputation,
    targetType,
    appeal.targetId,
  );
  if (!authorized) return { ok: false, error: 'not_authorized' };

  // Write immutable audit row first.
  const verdict = resolution === 'upheld' ? 'human_publish' : 'human_reject';
  await db.insert(moderationDecisions).values({
    targetType,
    targetId: appeal.targetId,
    provider: 'human',
    model: 'manual',
    scores: {},
    verdict,
    reasoning: resolutionMessage ?? null,
    reviewerId: user.id,
  });

  // Update content status (upheld only).
  if (resolution === 'upheld') {
    if (targetType === 'post') {
      await updatePostStatus(appeal.targetId, {
        newStatus: 'published',
        reason: resolutionMessage,
        actorId: user.id,
      });
    } else {
      await updateCommentStatus(appeal.targetId, {
        newStatus: 'published',
        reason: resolutionMessage,
        actorId: user.id,
      });
    }

    // Record positive reputation event for the original author.
    await recordEvent({
      userId: appeal.userId,
      kind: 'appeal_resolved_for_user',
      sourceId: appealId,
      reason: 'Appeal upheld',
    });
  }

  // Mark appeal as resolved.
  await db
    .update(appeals)
    .set({
      resolution,
      resolvedBy: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(appeals.id, appealId));

  // Notify the appeal author.
  await notify({
    userId: appeal.userId,
    kind: 'appeal_resolved',
    payload: {
      appealId,
      targetType,
      targetId: appeal.targetId,
      resolution,
      resolutionMessage: resolutionMessage ?? null,
    },
  });

  revalidatePath('/[locale]/(authenticated)/moderation/appeals', 'page');
  return { ok: true, data: { id: appealId } };
}
