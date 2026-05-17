/**
 * @repo/auth — core auth primitives.
 * Phase A implementation of docs/architecture/auth.md.
 */

// ── Shared types ──────────────────────────────────────────────────────────────

export type { TokenPurpose } from './types.ts';

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly handle: string;
  readonly displayName: string;
  readonly locale: string;
  readonly reputation: number;
}

export type AuthResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false;
      error: 'invalid_credentials' | 'unverified_email' | 'disabled' | 'rate_limited';
    };

// ── Password ──────────────────────────────────────────────────────────────────

export { hashPassword, verifyPassword, needsRehash } from './password.ts';

// ── Sessions ──────────────────────────────────────────────────────────────────

export {
  createSession,
  getSession,
  rotateSession,
  revokeSession,
  revokeAllForUser,
  revokeOtherSessions,
  sessionCookie,
} from './sessions.ts';

// ── Tokens ────────────────────────────────────────────────────────────────────

export { issueToken, consumeToken, TOKEN_TTL, hashToken } from './tokens.ts';

// ── CSRF ──────────────────────────────────────────────────────────────────────

export { issueCsrfToken, verifyCsrfToken } from './csrf.ts';

// ── Placeholder getCurrentUser (implemented by apps/app using getSession) ─────

// Placeholder — apps/app implements the full Server Component wrapper.
export async function getCurrentUser(): Promise<SessionUser | null> {
  return null;
}
