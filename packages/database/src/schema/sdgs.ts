import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Static lookup table. Seeded from @repo/sdg. Names live in code/i18n; the row
// exists for referential integrity on the M2M join tables.
export const sdgs = pgTable('sdgs', {
  id: integer('id').primaryKey(), // 1..17
  code: text('code').notNull().unique(), // slug, matches @repo/sdg
  color: text('color').notNull(), // hex
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});
