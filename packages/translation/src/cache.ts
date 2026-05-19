// Translation cache layer backed by Postgres (post_translations table).
//
// Translations are cached on first fetch and never updated. The original
// post/comment body is always preserved in the posts/comments tables.
//
// Cache key: (postId, commentId | null, sourceLocale, targetLocale).

import { db } from '@repo/database/client';
import { postTranslations } from '@repo/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { TranslationProvider } from './provider.ts';
import type { TranslatedText } from './types.ts';

export interface TranslateContentOptions {
  postId: string;
  /** Null for post-body translations; set for comment bodies. */
  commentId: string | null;
  text: string;
  sourceLocale: string;
  targetLocale: string;
}

/**
 * Translate content with Postgres caching.
 *
 * Returns the cached row if one exists; otherwise calls the provider,
 * inserts the result, then returns it.
 */
export async function translateWithCache(
  provider: TranslationProvider,
  opts: TranslateContentOptions,
): Promise<TranslatedText> {
  const { postId, commentId, text, sourceLocale, targetLocale } = opts;

  // Build the WHERE clause depending on whether we're targeting a comment.
  const commentCondition =
    commentId !== null
      ? eq(postTranslations.commentId, commentId)
      : isNull(postTranslations.commentId);

  // Attempt cache hit.
  const cached = await db
    .select({
      translatedBody: postTranslations.translatedBody,
      providerId: postTranslations.providerId,
    })
    .from(postTranslations)
    .where(
      and(
        eq(postTranslations.postId, postId),
        commentCondition,
        eq(postTranslations.sourceLocale, sourceLocale),
        eq(postTranslations.targetLocale, targetLocale),
      ),
    )
    .limit(1);

  if (cached.length > 0 && cached[0] !== undefined) {
    return {
      text: cached[0].translatedBody,
      from: sourceLocale,
      to: targetLocale,
      provider: cached[0].providerId,
    };
  }

  // Cache miss — call provider.
  const result = await provider.translate(text, sourceLocale, targetLocale);

  // Insert with ON CONFLICT DO NOTHING so concurrent requests don't error.
  await db
    .insert(postTranslations)
    .values({
      postId,
      commentId: commentId ?? undefined,
      sourceLocale,
      targetLocale,
      translatedBody: result.text,
      providerId: result.provider,
    })
    .onConflictDoNothing();

  return result;
}
