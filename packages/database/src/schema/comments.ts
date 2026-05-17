import { relations, sql } from 'drizzle-orm';
import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contentStatus } from './enums.ts';
import { posts } from './posts.ts';
import { users } from './users.ts';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    /** Threaded; null for top-level. */
    parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    locale: text('locale').notNull().default('en'),
    status: contentStatus('status').notNull().default('pending_ai'),
    statusReason: text('status_reason'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    postIdx: index('comments_post_idx').on(t.postId),
    parentIdx: index('comments_parent_idx').on(t.parentCommentId),
    authorIdx: index('comments_author_idx').on(t.authorId),
    statusIdx: index('comments_status_idx').on(t.status),
  }),
);

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  parent: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: 'comment_parent',
  }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));
