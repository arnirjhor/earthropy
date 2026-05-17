import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { reputationKind } from './enums.ts';
import { users } from './users.ts';

export const reputationEvents = pgTable(
  'reputation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: reputationKind('kind').notNull(),
    delta: integer('delta').notNull(),
    /** Free-text rationale; surfaced in user's reputation history view. */
    reason: text('reason'),
    /** Loose pointer (post id, comment id, appeal id) — type implied by kind. */
    sourceId: uuid('source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    userIdx: index('rep_events_user_idx').on(t.userId, t.createdAt),
  }),
);
