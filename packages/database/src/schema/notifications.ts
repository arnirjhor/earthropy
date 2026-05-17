import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { notificationKind } from './enums.ts';
import { users } from './users.ts';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    userUnreadIdx: index('notifications_user_unread_idx')
      .on(t.userId, t.createdAt)
      .where(sql`${t.readAt} IS NULL`),
    userIdx: index('notifications_user_idx').on(t.userId, t.createdAt),
  }),
);
