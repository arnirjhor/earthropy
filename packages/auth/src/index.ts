// Scaffold. Real implementation lands in Phase A step 2 (week 1–2):
//   - Argon2id password hashing (oslo/password or @node-rs/argon2)
//   - Session cookies (HttpOnly, SameSite=Lax, Secure in prod), 30-day rolling
//   - Email verification + magic-link tokens (rotate on use)
//   - CSRF middleware (double-submit token) for mutations
//
// Until then, export type stubs so apps can wire imports.

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
  | { ok: false; error: 'invalid_credentials' | 'unverified_email' | 'disabled' | 'rate_limited' };

// Placeholder — implemented in Phase A.
export async function getCurrentUser(): Promise<SessionUser | null> {
  return null;
}
