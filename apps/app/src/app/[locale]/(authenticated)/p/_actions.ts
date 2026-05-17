'use server';

import { getSession } from '@repo/auth';
import { createPost, withdrawPost } from '@repo/posts';
import { rateLimitAction } from '@repo/ratelimit';
import { cookies } from 'next/headers';
import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────────

const SdgIdSchema = z.number().int().min(1).max(17);

const CreatePostSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(1).max(500).trim(),
  body: z.string().min(1).max(50000).trim(),
  locale: z.string().min(2).max(20).default('en'),
  sdgIds: z.array(SdgIdSchema).min(1),
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

// ── createPostAction ───────────────────────────────────────────────────────────

/**
 * Create a new post from a FormData submission.
 *
 * Expects fields:
 *   groupId, title, body, locale, sdgIds (JSON array string).
 *
 * Rate-limited: 10 posts per 3600s per IP (heavy write path).
 */
export async function createPostAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await rateLimitAction({ key: 'post-create:ip', windowSec: 3600, max: 10, trustProxy: true });

  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const raw = {
    groupId: formData.get('groupId'),
    title: formData.get('title'),
    body: formData.get('body'),
    locale: formData.get('locale') ?? 'en',
    sdgIds: (() => {
      const v = formData.get('sdgIds');
      if (!v) return [];
      try {
        return JSON.parse(v as string) as unknown;
      } catch {
        return [];
      }
    })(),
  };

  const parsed = CreatePostSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors.map((e) => e.message).join('; ') };
  }

  const data = parsed.data;

  try {
    const post = await createPost({
      groupId: data.groupId,
      authorId: user.id,
      title: data.title,
      body: data.body,
      locale: data.locale,
      sdgIds: data.sdgIds as Parameters<typeof createPost>[0]['sdgIds'],
    });
    return { ok: true, data: { id: post.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

// ── withdrawPostAction ─────────────────────────────────────────────────────────

/**
 * Withdraw a post by id.
 *
 * Only the author may withdraw. Enforced in the `withdrawPost` data function.
 */
export async function withdrawPostAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'unauthenticated' };

  try {
    const result = await withdrawPost(id, user.id);
    return { ok: true, data: { id: result.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}
