import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tokenPurpose } from './enums.ts';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    /** BCP-47 locale tag, e.g. 'en', 'pt-BR'. */
    locale: text('locale').notNull().default('en'),
    /** Argon2id hash; null for users that only auth via magic link. */
    passwordHash: text('password_hash'),
    /** Cumulative reputation; see @repo/trust. */
    reputation: integer('reputation').notNull().default(0),
    /** Soft-disabled accounts cannot sign in or post; not deleted (audit retention). */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    emailUq: uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    handleUq: uniqueIndex('users_handle_lower_uq').on(sql`lower(${t.handle})`),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    /** Opaque, random; sent as cookie value. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Last seen User-Agent (truncated) — for the user's "active sessions" UI. */
    userAgent: text('user_agent'),
    /** Last seen IP, hashed/redacted at write time. Never store raw IP. */
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export const tokens = pgTable(
  'tokens',
  {
    /** Hashed token value (never store raw). */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: tokenPurpose('purpose').notNull(),
    /** Optional context, e.g. new email for an email-change verification. */
    payload: text('payload'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    userPurposeIdx: index('tokens_user_purpose_idx').on(t.userId, t.purpose),
  }),
);

export const followedSdgs = pgTable(
  'user_followed_sdgs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sdgId: integer('sdg_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: uniqueIndex('user_followed_sdgs_pk').on(t.userId, t.sdgId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  tokens: many(tokens),
  followedSdgs: many(followedSdgs),
}));
