// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Outcome tracking tables.
//
// IMPORTANT: All reported outcome values are self-attested by the reporting
// group. Earthropy does not perform external verification of these numbers.
// This is by design — see docs/moderation-policy.md for the transparency model.

import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { groups } from './groups.ts';
import { posts } from './posts.ts';
import { sdgs } from './sdgs.ts';
import { users } from './users.ts';

// ── sdg_indicators ─────────────────────────────────────────────────────────────
// Seeded from @repo/sdg INDICATORS. Rows are never deleted; the static metadata
// in @repo/sdg is the source of truth. DB rows exist for FK integrity on outcomes.

export const sdgIndicators = pgTable(
  'sdg_indicators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sdgId: integer('sdg_id')
      .notNull()
      .references(() => sdgs.id, { onDelete: 'restrict' }),
    /** Matches SdgIndicator.code from @repo/sdg, e.g. "15.2.1". Unique. */
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    unit: text('unit').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    sdgIdx: index('sdg_indicators_sdg_idx').on(t.sdgId),
  }),
);

// ── outcomes ───────────────────────────────────────────────────────────────────

export const outcomes = pgTable(
  'outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    indicatorId: uuid('indicator_id')
      .notNull()
      .references(() => sdgIndicators.id, { onDelete: 'restrict' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    value: numeric('value', { precision: 20, scale: 6 }).notNull(),
    unit: text('unit').notNull(),
    description: text('description').notNull(),
    /** Optional URL to external evidence (press release, report, photo, etc.). */
    evidenceUrl: text('evidence_url'),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    groupIndicatorIdx: index('outcomes_group_indicator_idx').on(t.groupId, t.indicatorId),
    groupReportedIdx: index('outcomes_group_reported_idx').on(t.groupId, t.reportedAt),
    indicatorIdx: index('outcomes_indicator_idx').on(t.indicatorId),
  }),
);

// ── outcome_posts ──────────────────────────────────────────────────────────────
// Optional junction: link an outcome to one or more posts for context.

export const outcomePosts = pgTable(
  'outcome_posts',
  {
    outcomeId: uuid('outcome_id')
      .notNull()
      .references(() => outcomes.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.outcomeId, t.postId] }),
    postIdx: index('outcome_posts_post_idx').on(t.postId),
  }),
);

// ── Relations ──────────────────────────────────────────────────────────────────

export const sdgIndicatorsRelations = relations(sdgIndicators, ({ one, many }) => ({
  sdg: one(sdgs, { fields: [sdgIndicators.sdgId], references: [sdgs.id] }),
  outcomes: many(outcomes),
}));

export const outcomesRelations = relations(outcomes, ({ one, many }) => ({
  group: one(groups, { fields: [outcomes.groupId], references: [groups.id] }),
  indicator: one(sdgIndicators, { fields: [outcomes.indicatorId], references: [sdgIndicators.id] }),
  reporter: one(users, { fields: [outcomes.reportedBy], references: [users.id] }),
  linkedPosts: many(outcomePosts),
}));

export const outcomePostsRelations = relations(outcomePosts, ({ one }) => ({
  outcome: one(outcomes, { fields: [outcomePosts.outcomeId], references: [outcomes.id] }),
  post: one(posts, { fields: [outcomePosts.postId], references: [posts.id] }),
}));
