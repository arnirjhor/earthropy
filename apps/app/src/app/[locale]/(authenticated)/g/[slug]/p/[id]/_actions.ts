'use server';

import { getSession } from '@repo/auth';
import { createComment, withdrawComment } from '@repo/comments';
import { rateLimitAction } from '@repo/ratelimit';
import { createTranslationProvider, translateWithCache } from '@repo/translation';
import { cookies } from 'next/headers';
import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────────

const TranslateContentSchema = z.object({
  postId: z.string().uuid(),
  commentId: z.string().uuid().optional(),
  text: z.string().min(1).max(100_000),
  sourceLocale: z.string().min(2).max(20),
  targetLocale: z.string().min(2).max(20),
});

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

// ── translateContentAction ─────────────────────────────────────────────────────

/**
 * Translate a post body or comment body.
 *
 * Cached in Postgres (post_translations table). Auth-gated: only signed-in
 * users may request translations (reduces abuse surface).
 *
 * Rate-limited: 60 translation requests per 3600s per IP.
 */
export async function translateContentAction(
  formData: FormData,
): Promise<ActionResult<{ translatedText: string; provider: string }>> {
  await rateLimitAction({
    key: 'translation:ip',
    windowSec: 3600,
    max: 60,
    trustProxy: true,
  });

  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const raw = {
    postId: formData.get('postId'),
    commentId: formData.get('commentId') ?? undefined,
    text: formData.get('text'),
    sourceLocale: formData.get('sourceLocale'),
    targetLocale: formData.get('targetLocale'),
  };

  const parsed = TranslateContentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const data = parsed.data;

  if (data.sourceLocale === data.targetLocale) {
    return { ok: false, error: 'sourceLocale and targetLocale are the same' };
  }

  try {
    const provider = createTranslationProvider();
    const result = await translateWithCache(provider, {
      postId: data.postId,
      commentId: data.commentId ?? null,
      text: data.text,
      sourceLocale: data.sourceLocale,
      targetLocale: data.targetLocale,
    });
    return { ok: true, data: { translatedText: result.text, provider: result.provider } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}
