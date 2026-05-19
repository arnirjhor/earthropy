import { relations, sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { groups } from './groups.ts';
import { users } from './users.ts';

export const communityAgentTaskKind = pgEnum('community_agent_task_kind', [
  'stale_discussions',
  'member_suggestions',
  'weekly_digest',
]);

export const communityAgentTaskStatus = pgEnum('community_agent_task_status', [
  'success',
  'failure',
  'skipped',
]);

/**
 * Immutable log of community-agent task runs.
 * One row per task invocation; errors are stored in the error_message field.
 */
export const communityAgentRuns = pgTable(
  'community_agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskKind: communityAgentTaskKind('task_kind').notNull(),
    /** Optional group context — null for user-scoped tasks. */
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    /** Optional user context — null for group-scoped tasks. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Provider name, e.g. 'anthropic', 'ollama'. */
    provider: text('provider').notNull(),
    /** Model identifier. */
    model: text('model').notNull(),
    status: communityAgentTaskStatus('status').notNull(),
    /** JSON summary of the run result, e.g. {suggestionsCount: 3}. */
    resultSummary: jsonb('result_summary').$type<Record<string, unknown>>().default({}),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    taskKindIdx: index('agent_runs_task_kind_idx').on(t.taskKind, t.createdAt),
    groupIdx: index('agent_runs_group_idx').on(t.groupId, t.createdAt),
    userIdx: index('agent_runs_user_idx').on(t.userId, t.createdAt),
  }),
);

/**
 * Per-user opt-in settings for community-agent features.
 * One row per user; created on first opt-in action.
 */
export const userAgentPreferences = pgTable('user_agent_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Whether the user wants to receive weekly digest emails for their groups. */
  digestEmailEnabled: boolean('digest_email_enabled').notNull().default(false),
  /** Whether the user wants group suggestions when they follow new SDGs. */
  groupSuggestionsEnabled: boolean('group_suggestions_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const communityAgentRunsRelations = relations(communityAgentRuns, ({ one }) => ({
  group: one(groups, { fields: [communityAgentRuns.groupId], references: [groups.id] }),
  user: one(users, { fields: [communityAgentRuns.userId], references: [users.id] }),
}));

export const userAgentPreferencesRelations = relations(userAgentPreferences, ({ one }) => ({
  user: one(users, { fields: [userAgentPreferences.userId], references: [users.id] }),
}));
