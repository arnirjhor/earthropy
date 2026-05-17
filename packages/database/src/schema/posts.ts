import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { contentStatus } from './enums.ts';
import { groups } from './groups.ts';
import { sdgs } from './sdgs.ts';
import { users } from './users.ts';

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** BCP-47; defaults to the group's preferred_locale at create time. */
    locale: text('locale').notNull().default('en'),
    status: contentStatus('status').notNull().default('pending_ai'),
    /** Author-visible reason when status is rejected or pending_review. */
    statusReason: text('status_reason'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    groupStatusCreatedIdx: index('posts_group_status_created_idx').on(
      t.groupId,
      t.status,
      t.createdAt,
    ),
    authorIdx: index('posts_author_idx').on(t.authorId),
    statusIdx: index('posts_status_idx').on(t.status),
  }),
);

export const postSdgs = pgTable(
  'post_sdgs',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    sdgId: integer('sdg_id')
      .notNull()
      .references(() => sdgs.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.sdgId] }),
    sdgIdx: index('post_sdgs_sdg_idx').on(t.sdgId),
  }),
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  group: one(groups, { fields: [posts.groupId], references: [groups.id] }),
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  sdgs: many(postSdgs),
}));

export const postSdgsRelations = relations(postSdgs, ({ one }) => ({
  post: one(posts, { fields: [postSdgs.postId], references: [posts.id] }),
  sdg: one(sdgs, { fields: [postSdgs.sdgId], references: [sdgs.id] }),
}));
