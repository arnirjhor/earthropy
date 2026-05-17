'use server';

import { getSession } from '@repo/auth';
import { createComment, withdrawComment } from '@repo/comments';
import { rateLimitAction } from '@repo/ratelimit';
import { cookies } from 'next/headers';
import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────────

const CreateCommentSchema = z.object({
  postId: z.string().uuid(),
  parentCommentId: z.string().uuid().optional(),
  body: z.string().min(1).max(10000).trim(),
  locale: z.string().min(2).max(20).default('en'),
});

// ── Action result type ─────────────────────────────────────────────────────────

export type ActionError = { ok: false; error: string };
export type ActionOk<T> = { ok: true; data: T };
export type ActionResult<T> = ActionOk<T> | ActionError;

// ── Session helper ─────────────────────────────────────────────────────────────

async function requireSession() {
  const jar = await cookies();
  const sessionId = jar.get('earthropy_session')?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}

// ── createCommentAction ────────────────────────────────────────────────────────

/**
 * Create a new comment from a FormData submission.
 *
 * Expects fields:
 *   postId, body, locale, parentCommentId (optional UUID string).
 *
 * Rate-limited: 30 comments per 3600s per IP (moderate write path).
 */
export async function createCommentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await rateLimitAction({ key: 'comment-create:ip', windowSec: 3600, max: 30, trustProxy: true });

  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const raw = {
    postId: formData.get('postId'),
    parentCommentId: formData.get('parentCommentId') ?? undefined,
    body: formData.get('body'),
    locale: formData.get('locale') ?? 'en',
  };

  const parsed = CreateCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const data = parsed.data;

  try {
    const comment = await createComment({
      postId: data.postId,
      authorId: user.id,
      parentCommentId: data.parentCommentId,
      body: data.body,
      locale: data.locale,
    });
    return { ok: true, data: { id: comment.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

// ── withdrawCommentAction ──────────────────────────────────────────────────────

/**
 * Withdraw a comment by id.
 *
 * Only the author may withdraw. Enforced in the `withdrawComment` data function.
 */
export async function withdrawCommentAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  try {
    const result = await withdrawComment(id, user.id);
    return { ok: true, data: { id: result.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}
