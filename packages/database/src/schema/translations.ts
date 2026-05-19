import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { comments } from './comments.ts';
import { posts } from './posts.ts';

// Cached machine translations. Translations are read-only after insert;
// originals are always preserved in the posts/comments tables.
//
// Cache key: (post_id, comment_id, source_locale, target_locale).
// If comment_id is null the row is a post-body translation.
export const postTranslations = pgTable(
  'post_translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The post this translation belongs to. */
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    /** Null for post-body translations; set for comment-body translations. */
    commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
    /** BCP-47 source language, e.g. 'en'. */
    sourceLocale: text('source_locale').notNull(),
    /** BCP-47 target language, e.g. 'fr'. */
    targetLocale: text('target_locale').notNull(),
    /** The translated body text. */
    translatedBody: text('translated_body').notNull(),
    /** Provider identifier, e.g. 'libretranslate' | 'deepl'. */
    providerId: text('provider_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    // Enforce uniqueness of the cache key.
    cacheKey: unique('post_translations_cache_key').on(
      t.postId,
      t.commentId,
      t.sourceLocale,
      t.targetLocale,
    ),
    postIdx: index('post_translations_post_idx').on(t.postId),
    commentIdx: index('post_translations_comment_idx').on(t.commentId),
  }),
);

export const postTranslationsRelations = relations(postTranslations, ({ one }) => ({
  post: one(posts, { fields: [postTranslations.postId], references: [posts.id] }),
  comment: one(comments, { fields: [postTranslations.commentId], references: [comments.id] }),
}));
