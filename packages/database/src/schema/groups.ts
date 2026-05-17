import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { groupVisibility, memberRole } from './enums.ts';
import { sdgs } from './sdgs.ts';
import { users } from './users.ts';

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    visibility: groupVisibility('visibility').notNull().default('public'),
    preferredLocale: text('preferred_locale').notNull().default('en'),
    /** Free-text location, optional. v0.1 does not geocode. */
    locationText: text('location_text'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    slugUq: uniqueIndex('groups_slug_lower_uq').on(sql`lower(${t.slug})`),
    createdByIdx: index('groups_created_by_idx').on(t.createdBy),
  }),
);

export const groupSdgs = pgTable(
  'group_sdgs',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    sdgId: integer('sdg_id')
      .notNull()
      .references(() => sdgs.id, { onDelete: 'restrict' }),
    /** Exactly one primary per group; enforced by partial unique index in migration. */
    primary: boolean('primary').notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.sdgId] }),
  }),
);

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.userId] }),
    userIdx: index('group_members_user_idx').on(t.userId),
  }),
);

export const groupsRelations = relations(groups, ({ many, one }) => ({
  sdgs: many(groupSdgs),
  members: many(groupMembers),
  creator: one(users, { fields: [groups.createdBy], references: [users.id] }),
}));

export const groupSdgsRelations = relations(groupSdgs, ({ one }) => ({
  group: one(groups, { fields: [groupSdgs.groupId], references: [groups.id] }),
  sdg: one(sdgs, { fields: [groupSdgs.sdgId], references: [sdgs.id] }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));
