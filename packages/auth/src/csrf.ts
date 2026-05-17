/**
 * CSRF double-submit cookie helpers.
 * §6 of docs/architecture/auth.md.
 *
 * Token = HMAC-SHA-256(sessionId, AUTH_SECRET), hex-encoded.
 * Constant-time compare on verify (timingSafeEqual).
 * No DB row needed — the HMAC math is self-contained.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.ts';

/**
 * Produce a CSRF token bound to the given sessionId.
 * The same value goes in the csrf_token cookie AND in the hidden form input.
 * (auth.md §6.1)
 */
export function issueCsrfToken(sessionId: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(sessionId).digest('hex');
}

/**
 * Verify that `submitted` is the CSRF token for the current session.
 * Returns false if empty, tampered, or from a different session.
 * Uses constant-time comparison (auth.md §6.2).
 */
export function verifyCsrfToken(sessionId: string, submitted: string): boolean {
  if (!submitted) return false;
  const expected = issueCsrfToken(sessionId);

  // Both must be the same length before we can use timingSafeEqual.
  if (expected.length !== submitted.length) return false;

  const expectedBuf = Buffer.from(expected, 'utf8');
  const submittedBuf = Buffer.from(submitted, 'utf8');

  return timingSafeEqual(expectedBuf, submittedBuf);
}
