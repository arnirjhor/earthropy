/**
 * Single-use bearer tokens for email verification, magic links, and password reset.
 * §4 of docs/architecture/auth.md.
 *
 * Raw token: 32 bytes from crypto.randomBytes, base64url (43 chars).
 * Stored value: SHA-256 of raw token, base64url (43 chars).
 * Atomic delete-on-read (consume = DELETE … RETURNING).
 */
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@repo/database/client';
import { tokens } from '@repo/database/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { TokenPurpose } from './types.ts';

export type { TokenPurpose };

/**
 * Generate a raw token (32 random bytes, base64url).
 */
function generateRaw(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 of the raw token, base64url-encoded.
 * This is what gets stored as tokens.id.
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('base64url');
}

/**
 * Issue a token for `userId` with the given `purpose`.
 * Writes only the hash to the DB; returns the raw token for the caller
 * to include in an email and then discard (auth.md §4.2).
 */
export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  payload: string | null,
  ttlSeconds: number,
): Promise<{ rawToken: string }> {
  const rawToken = generateRaw();
  const hashed = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await db.insert(tokens).values({
    id: hashed,
    userId,
    purpose,
    payload,
    expiresAt,
  });

  return { rawToken };
}

/**
 * Consume a token atomically (delete-on-read, auth.md §4.3).
 * Returns { userId, payload } on success; null if the token is invalid,
 * expired, already consumed, or has the wrong purpose.
 */
export async function consumeToken(
  rawToken: string,
  purpose: TokenPurpose,
): Promise<{ userId: string; payload: string | null } | null> {
  const hashed = hashToken(rawToken);
  const now = new Date();

  // Atomic DELETE … RETURNING via Drizzle execute
  const result = await db
    .delete(tokens)
    .where(
      and(
        eq(tokens.id, hashed),
        eq(tokens.purpose, purpose),
        gt(tokens.expiresAt, now),
        isNull(tokens.consumedAt),
      ),
    )
    .returning({ userId: tokens.userId, payload: tokens.payload });

  const row = result[0];
  if (!row) return null;

  return { userId: row.userId, payload: row.payload };
}

/** TTL constants per auth.md §4.4 */
export const TOKEN_TTL = {
  email_verification: 24 * 60 * 60, // 24 hours
  magic_link: 15 * 60, // 15 minutes
  password_reset: 60 * 60, // 60 minutes
} as const satisfies Record<TokenPurpose, number>;
