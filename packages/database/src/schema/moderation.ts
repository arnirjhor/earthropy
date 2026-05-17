import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moderationTarget, moderationVerdict } from './enums.ts';
import { users } from './users.ts';

export type ModerationScores = Record<string, number>;

// Immutable audit log. Never UPDATE these rows; corrections happen by inserting
// a follow-up decision (e.g. a moderator override row). The moderation policy
// in /docs/moderation-policy.md depends on this guarantee.
export const moderationDecisions = pgTable(
  'moderation_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetType: moderationTarget('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    /** Provider name, e.g. 'anthropic', 'ollama-llama-guard', 'human'. */
    provider: text('provider').notNull(),
    /** Model identifier (or 'manual' for human decisions). */
    model: text('model').notNull(),
    scores: jsonb('scores').$type<ModerationScores>().notNull().default({}),
    verdict: moderationVerdict('verdict').notNull(),
    reasoning: text('reasoning'),
    /** Set when verdict came from a human (human_publish / human_reject). */
    reviewerId: uuid('reviewer_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    targetIdx: index('mod_decisions_target_idx').on(t.targetType, t.targetId),
    createdIdx: index('mod_decisions_created_idx').on(t.createdAt),
  }),
);

export const appeals = pgTable(
  'appeals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetType: moderationTarget('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    resolution: text('resolution'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    targetIdx: index('appeals_target_idx').on(t.targetType, t.targetId),
    userIdx: index('appeals_user_idx').on(t.userId),
    unresolvedIdx: index('appeals_unresolved_idx')
      .on(t.createdAt)
      .where(sql`${t.resolvedAt} IS NULL`),
  }),
);
