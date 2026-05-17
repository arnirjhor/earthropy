/**
 * Opaque server-side sessions.
 * §3 of docs/architecture/auth.md.
 *
 * Session id: 32 random bytes, base64url-encoded (43 chars).
 * Stored unhashed in sessions.id (cookie value = PK).
 * IP stored as HMAC-SHA-256 of raw IP, truncated to 16 bytes hex.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { db } from '@repo/database/client';
import { sessions, users } from '@repo/database/schema';
import { and, eq, gt, ne } from 'drizzle-orm';
import { env } from './env.ts';
import type { SessionUser } from './index.ts';

/** Absolute hard cap on session lifetime from creation. §3.3 */
const SESSION_ABSOLUTE_DAYS = 90;

function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

function absoluteExpiry(fromDate: Date = new Date()): Date {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + SESSION_ABSOLUTE_DAYS);
  return d;
}

/**
 * Hash a raw IP address using HMAC-SHA-256 and return the first 16 bytes as hex.
 * Raw IPs are never stored (auth.md §3.2).
 */
function hashIp(rawIp: string): string {
  return createHmac('sha256', env.IP_HASH_SECRET).update(rawIp).digest('hex').slice(0, 32); // 16 bytes = 32 hex chars
}

/**
 * Create a new session for the given user.
 * Returns { id, expiresAt } — the id is the cookie value.
 */
export async function createSession(
  userId: string,
  opts: { userAgent?: string; ip?: string } = {},
): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId();
  const expiresAt = absoluteExpiry();
  const userAgent = opts.userAgent ? opts.userAgent.slice(0, 255) : null;
  const ipHash = opts.ip ? hashIp(opts.ip) : null;

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    userAgent,
    ipHash,
  });

  return { id, expiresAt };
}

/**
 * Look up a session by id and return the joined SessionUser if the session
 * is live and the user is not disabled.
 * Returns null for expired, revoked, or disabled-user sessions (auth.md §3.6).
 */
export async function getSession(id: string): Promise<SessionUser | null> {
  const now = new Date();
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      handle: users.handle,
      displayName: users.displayName,
      locale: users.locale,
      reputation: users.reputation,
      disabledAt: users.disabledAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.disabledAt !== null) return null;

  return {
    id: row.userId,
    email: row.email,
    handle: row.handle,
    displayName: row.displayName,
    locale: row.locale,
    reputation: row.reputation,
  };
}

/**
 * Atomic session rotation: insert new row (carrying over userId, userAgent,
 * ipHash, and a fresh absolute expiry), then delete the old row.
 * Returns the new { id, expiresAt }.
 * If the transaction fails, the caller keeps the old cookie (auth.md §3.4).
 */
export async function rotateSession(oldId: string): Promise<{ id: string; expiresAt: Date }> {
  // First, read the existing session to carry over context fields.
  const existing = await db.select().from(sessions).where(eq(sessions.id, oldId)).limit(1);

  const old = existing[0];
  if (!old) throw new Error(`rotateSession: session not found: ${oldId}`);

  const newId = generateSessionId();
  const newExpiresAt = absoluteExpiry();

  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({
      id: newId,
      userId: old.userId,
      expiresAt: newExpiresAt,
      userAgent: old.userAgent,
      ipHash: old.ipHash,
    });
    await tx.delete(sessions).where(eq(sessions.id, oldId));
  });

  return { id: newId, expiresAt: newExpiresAt };
}

/**
 * Delete a single session by id (and optional userId guard, auth.md §3.6).
 */
export async function revokeSession(id: string, userId?: string): Promise<void> {
  if (userId) {
    await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
  } else {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
}

/**
 * Delete all sessions for a user — used on password reset and account disable
 * (auth.md §3.6 revocation cascade).
 */
export async function revokeAllForUser(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Delete all sessions for a user except the current one.
 * Used by "Revoke all other sessions" in the active-sessions UI.
 */
export async function revokeOtherSessions(userId: string, currentId: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, currentId)));
}

/**
 * Build the Set-Cookie config for the session cookie.
 * Secure flag is env-driven per auth.md §3.1.
 */
export function sessionCookie(
  id: string,
  expiresAt: Date,
): {
  name: 'earthropy_session';
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === '1';

  return {
    name: 'earthropy_session',
    value: id,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}
