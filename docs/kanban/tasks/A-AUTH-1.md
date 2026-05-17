---
id: A-AUTH-1
title: "@repo/auth core: sessions, Argon2id, token table, CSRF helpers"
status: backlog
priority: critical
phase: A
agent_model: sonnet
deps: [A-AUTH-DESIGN, X-VITEST-1]
tags: [auth, security]
owner: ""
branch: ""
pr: ""
estimated_hours: 5
created: 2026-05-18
updated: 2026-05-18
---

## Description
Implement the auth primitives from `docs/architecture/auth.md`: password hashing (Argon2id via `@node-rs/argon2`), opaque session tokens, token issue/consume for email verification + magic link + password reset, CSRF helpers. No UI in this task — pure `@repo/auth` exports consumed later by `apps/app`.

## Acceptance criteria
- [ ] `@node-rs/argon2` added as a dep of `@repo/auth` (MIT, vetted-allowlist).
- [ ] `hashPassword(plain) → Promise<string>` and `verifyPassword(plain, hash) → Promise<boolean>` using OWASP 2025 Argon2id params.
- [ ] `createSession(userId, { userAgent, ip }) → Promise<{ id, expiresAt }>` writes to `sessions` table; cookie helper `sessionCookie(id, expiresAt)` returns a `Set-Cookie` config (HttpOnly, SameSite=Lax, Secure in prod).
- [ ] `getSession(id) → Promise<SessionUser | null>` joins `users` and returns the slim `SessionUser` shape already declared in `packages/auth/src/index.ts`.
- [ ] `rotateSession(id) → newId` for idle-rotation; old id invalidated.
- [ ] `revokeSession(id)`; `revokeAllForUser(userId)`.
- [ ] Token primitives: `issueToken(userId, purpose, payload?, ttlSeconds)` stores hash-on-store; `consumeToken(rawToken, purpose) → { userId, payload } | null` is atomic (delete-on-read).
- [ ] CSRF: `issueCsrfToken(sessionId)` + `verifyCsrfToken(sessionId, submitted)` for non–Server-Action flows.
- [ ] All exports type-clean; no `any`.
- [ ] Vitest coverage ≥ 90% for the package.

## Test plan
- `packages/auth/src/password.test.ts` — hash/verify round-trip; different salts produce different hashes; constant-time verify.
- `packages/auth/src/sessions.test.ts` — create + get + rotate + revoke; expired session returns null; revoked id invalid.
- `packages/auth/src/tokens.test.ts` — issue + consume happy path; consume twice returns null (single-use); wrong purpose returns null; expired token returns null.
- `packages/auth/src/csrf.test.ts` — issue + verify happy path; tampered token rejected; verify across sessions rejected.

## Notes
Use the existing `sessions` and `tokens` tables (`packages/database/src/schema/users.ts`). Don't add new schema in this task. Test against a real Postgres (the running compose instance); test transactions roll back so tests are isolated.
