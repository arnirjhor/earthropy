# Auth subsystem design

Status: accepted (A-AUTH-DESIGN)
Authoritative for: `packages/auth`, `apps/app` auth routes, `@repo/notifications` transactional email, `@repo/ratelimit` (if extracted)
Implementers: A-AUTH-1 (core primitives), A-AUTH-2 (email transport), A-AUTH-3 (pages), A-AUTH-4 (account), A-RATE-1 (rate limit)
Reviewers check the implementation against this file. Deviations land as appended sections in this file with rationale and date; the original wording does not get edited in place.

Existing primitives this doc builds on:
- Schema: `packages/database/src/schema/users.ts` (`users`, `sessions`, `tokens`, `user_followed_sdgs`).
- Token purpose enum: `packages/database/src/schema/enums.ts` (`email_verification | magic_link | password_reset`).
- Type surface stubs: `packages/auth/src/index.ts` (`SessionUser`, `AuthResult`, `getCurrentUser`).
- Reputation tiers + capability gates: `packages/trust/src/index.ts`.
- Repo conventions: `CLAUDE.md` "Architectural rules (load-bearing)".
- Transparency promise that constrains auth-side logging: `docs/moderation-policy.md`.

---

## 1. Mission alignment

Earthropy is forever-free and corp-agnostic, so identity must not depend on a corporate IdP. Email + password and email + magic-link cover both the "I want a password" user and the "send me a link" user without a third-party provider; both flows run against any SMTP server (MailHog locally, a self-hoster's relay, or a paid sender like Resend through an adapter). Sessions are server-side and opaque to satisfy revocation guarantees, which matters for accounts that may face harassment around contentious SDG topics. Password hashing uses Argon2id with the modern OWASP profile so that a hosted instance can sustain low-cost commodity hardware without weakening defenses. Every choice below is a primitive a self-hoster can audit and replace; no choice ties the platform to a single vendor.

---

## 2. Identity lifecycle

States are derived from columns on `users` (no separate state column):

- `anonymous` — no `users` row, no `sessions` row, no cookie.
- `signed-up-unverified` — `users.email_verified_at IS NULL`, `users.disabled_at IS NULL`. A row exists but the user cannot post (`packages/trust` `accountAgeHours` gate plus the explicit unverified guard in Server Actions).
- `signed-up-verified` — `users.email_verified_at IS NOT NULL`, no active session.
- `signed-in` — at least one row in `sessions` with `expires_at > now()` matching the cookie value.
- `signed-out` — same `users` state as `signed-up-verified`; reached by explicit sign-out or session expiry/revocation.
- `password-reset-pending` — a non-consumed `tokens` row exists with `purpose = 'password_reset'` and `expires_at > now()`. Orthogonal to signed-in/signed-out — a user may request a reset while signed in (e.g., they suspect compromise) without being kicked out until they actually consume the token.
- `disabled` — `users.disabled_at IS NOT NULL`. Cannot sign in, cannot post; the row is retained for moderation-decision audit lineage.

```
                                  POST /signup (valid email + password)
                                            │
                                            ▼
       ┌──────────────┐  POST /signin  ┌──────────────────────────┐  POST /verify-email (valid token)
       │  anonymous   │ ───────────────│  signed-up-unverified    │ ───────────────────────────────────┐
       │              │  (rejected if  │  (users row, no          │                                    │
       │              │   unverified)  │   email_verified_at,     │                                    │
       │              │                │   no active session)     │                                    │
       └──────┬───────┘                └─────────┬────────────────┘                                    │
              │                                  │                                                    ▼
              │ POST /signin                     │ POST /verify-email/resend                ┌──────────────────────┐
              │ (verified user,                  │ (rate-limited; reissues token)           │ signed-up-verified   │
              │  correct creds                   │ self-loop ───────────────────┐           │  (verified, no       │
              │  OR valid magic                  │                              │           │   session)           │
              │  link consumed)                  │                              └──────────►│                      │
              │                                  │                                          └────────┬─────────────┘
              │                                  │                                                   │
              │                                  │                                                   │ POST /signin
              │                                  │                                                   │ (password OR
              │                                  │                                                   │  magic link)
              │                                  │                                                   ▼
              │                                  │                                          ┌──────────────────────┐
              └──────────────────────────────────┼─────────────────────────────────────────►│      signed-in       │
                                                 │                                          │  (sessions row,      │
                                                 │                                          │   cookie set)        │
                                                 │                                          └────────┬─────────────┘
                                                 │                                                   │
                                                 │  POST /forgot-password (issues reset token)       │
                                                 │  ─────────────────────────────────────────────────┤
                                                 │                                                   │
                                                 ▼                                                   │
                          ┌──────────────────────────────────┐                                       │
                          │   password-reset-pending          │ ◄─────────────────────────────────────┤
                          │   (tokens row, purpose=           │   POST /forgot-password from
                          │    password_reset, expires>now)   │   any state (verified user)
                          │   orthogonal to signed-in/out     │
                          └──────────────────┬────────────────┘
                                             │ POST /reset-password (valid token + new password)
                                             │ → consume token, rotate password_hash,
                                             │   revokeAllForUser, issue fresh session
                                             ▼
                                       signed-in (fresh session)

       ┌──────────────┐   POST /account/disable (signed-in user)        ┌──────────────────────┐
       │  signed-in   │ ──────────────────────────────────────────────► │      disabled        │
       │              │   sets users.disabled_at,                        │ (users row retained, │
       │              │   revokeAllForUser, clears cookie                │  audit-immutable;    │
       └──────────────┘                                                  │  no sign-in)         │
                                                                         └──────────────────────┘

       Sign-out / session expiry / admin revoke:
         signed-in ──── POST /signout OR sessions.expires_at <= now() OR revokeSession(id) ───► signed-up-verified

       Disabled accounts cannot transition back to signed-in via this codebase; reactivation
       is a manual core-team admin operation (clears users.disabled_at) and is intentionally
       out of scope for v0.1.
```

Transitions valid only in the direction shown. The `disabled` state has no programmatic exit in v0.1.

---

## 3. Sessions

Server-side opaque sessions. The cookie carries an opaque id; all session state lives in the `sessions` table (`packages/database/src/schema/users.ts`).

### 3.1 Cookie

- Name: `earthropy_session`. Single fixed name; no per-env suffixes (a hosted preview vs prod separation is achieved via different domains).
- Value: the opaque session id (see 3.2). The cookie value itself is the lookup key — no signing layer, because the value is high-entropy and constant-time-compared against the DB.
- Attributes:
  - `HttpOnly` — always.
  - `Secure` — set when `process.env.NODE_ENV === 'production'` OR `process.env.FORCE_SECURE_COOKIES === '1'`. In dev over `http://localhost` the flag is omitted so the cookie sticks.
  - `SameSite=Lax` — default. Lax allows top-level GET navigation cookies (needed for magic-link click-through), blocks cross-site POSTs (which closes the CSRF window for Server Actions; see Section 6).
  - `Path=/` — sessions are app-wide.
  - `Domain` — not set; cookie is host-only. Subdomain sharing is not in scope for v0.1.
  - `Max-Age` — set to the seconds remaining until the absolute expiry of the session (see 3.3). The cookie expiry mirrors the DB `expires_at` so a stale cookie is never sent on a session that is already gone.

Illustrative shape (no implementation):

```ts
function sessionCookie(id: string, expiresAt: Date): {
  name: 'earthropy_session';
  value: string;
  httpOnly: true;
  secure: boolean;          // env-driven
  sameSite: 'lax';
  path: '/';
  maxAge: number;           // seconds; floor((expiresAt - now)/1000)
};
```

### 3.2 Opaque token shape

- Generated via `crypto.randomBytes(32)` (Node `crypto`; no external dep).
- Encoded as base64url (43 chars, no padding). 256 bits of entropy is overkill for guessing resistance but cheap and aligns with current OWASP session-id guidance.
- The id is the primary key of `sessions`; it is also the literal cookie value. Stored unhashed (the table is access-controlled; an attacker who can read `sessions` already owns the system, so hashing buys nothing here). This is a deliberate departure from how token rows are stored — `sessions` are not bearer tokens transmitted over insecure email channels, they live only in the cookie jar.
- `userAgent` truncated at 255 chars before write. `ipHash` is HMAC-SHA-256 of the raw IP using a server-side secret (env `IP_HASH_SECRET`), truncated to 16 bytes hex; raw IPs are never persisted, satisfying the moderation-policy stance on minimal retention.

### 3.3 Expiry: idle vs absolute

Two clocks, the stricter wins:

| Clock                | Value                         | Mechanism                                                                                                         |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Idle (sliding)       | 14 days since last seen       | On every authenticated request, if `now - sessions.createdAt > 24h` AND `sessions.expiresAt - now < 14d - 6h`, rotate (see 3.4) and bump `expiresAt`. |
| Absolute (hard cap)  | 90 days since session creation | Set at creation; never extended. Rotation produces a new row with its own 90-day cap (so a frequently-used account effectively stays signed in indefinitely as long as rotation keeps happening within the idle window). |

Rationale: a single sliding window without an absolute cap means a compromised cookie that the user never notices stays valid forever. A single absolute window without sliding forces re-auth even for active users, which on a forever-free volunteer platform punishes the most engaged users. Two clocks are the standard answer.

### 3.4 Rotation on auth events

Issue a fresh session id and invalidate the old one when:

- A user signs in (delete the anonymous-state cookie if any, write a new row).
- A user completes email verification (the in-progress unverified session becomes verified — same `userId` but the id must change to defend against fixation).
- A user changes their password (regardless of whether through `/reset-password` or a future `/account/change-password`).
- A user revokes a session from the active-sessions UI: only that session id ends; current session continues.
- Account disable: all sessions for the user are deleted in a single transaction.

Rotation contract:

```ts
function rotateSession(oldId: string): Promise<{ id: string; expiresAt: Date }>; // atomic: insert new + delete old
```

Atomicity: a single DB transaction that inserts the new row (carrying over `userId`, `userAgent`, `ipHash`, `createdAt` from old; `expiresAt` reset to absolute cap from `now()`) and deletes the old row. If the transaction fails the caller keeps the old cookie.

### 3.5 Active sessions UI shape

`/account` lists each non-expired row from `sessions` for the current user:

```
┌────────────────────────────────────────────────────────────────────┐
│ Current device         Firefox 138 / macOS         created 3 days ago │
│                        last seen 4 minutes ago                          │
│                                                                         │
│ Other devices                                                           │
│  Safari iOS 17 / iPhone     created 11 days ago    [Revoke]            │
│  Chrome 135 / Linux         created 27 days ago    [Revoke]            │
└────────────────────────────────────────────────────────────────────┘
                                                     [ Revoke all other sessions ]
```

Data shown: parsed-out browser and OS family from `userAgent` (no external geolocation, no IP — we have only the hash), creation timestamp, last-seen approximation (the implementation may either store a `lastSeenAt` via best-effort on each request or simply use `createdAt` and accept the limitation; the schema's `createdAt` covers the latter without a migration). Revoke is a Server Action that calls `revokeSession(id)`; revoking the current session redirects to `/signin`.

### 3.6 Revocation cascade

| Trigger                                  | Effect                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| User clicks "Revoke" on a session row    | `DELETE FROM sessions WHERE id = $1 AND user_id = $2`. The next request from that cookie fails auth.    |
| User clicks "Revoke all other sessions"  | `DELETE FROM sessions WHERE user_id = $1 AND id <> $2`.                                                 |
| User clicks "Sign out"                   | `DELETE FROM sessions WHERE id = $1`; clear cookie via expired Set-Cookie header.                       |
| Password reset completed                 | `DELETE FROM sessions WHERE user_id = $1`; issue a fresh session for the actor browser.                 |
| Account disabled (`/account/disable`)    | Transaction: `UPDATE users SET disabled_at = now()` + `DELETE FROM sessions WHERE user_id = $1`. Clear cookie. |
| Admin revoke (future, not v0.1)          | `DELETE FROM sessions WHERE user_id = $1`. Logged in an `admin_actions` table when that lands.          |
| Session expiry (idle or absolute)        | `getSession` returns null for any row where `expires_at <= now()`; a periodic cleanup job (or lazy delete during `getSession`) reclaims rows. |

Cascade is enforced at the SQL layer where possible (`sessions.userId` has `onDelete: 'cascade'`, so deleting a `users` row tears down sessions — used only in irreversible deletion, which is not a v0.1 feature; disable is a soft delete). All revocation operations are idempotent.

---

## 4. Tokens (`email_verification` / `magic_link` / `password_reset`)

The `tokens` table holds **hashes** of every bearer token Earthropy mails to a user. Per `packages/database/src/schema/users.ts`, `tokens.id` is the storage column and the schema comment says "Hashed token value (never store raw)." This doc commits to that contract.

### 4.1 Shape and entropy

- Raw token: 32 bytes from `crypto.randomBytes`, encoded base64url (43 chars). 256 bits.
- Stored value (the `tokens.id` column): SHA-256 of the raw token, encoded base64url (43 chars). The hash is deterministic and unsalted because the input already has 256 bits of entropy; no rainbow-table risk exists and adding a salt would force an O(n) scan per consume rather than a primary-key lookup.
- URL form: `https://<host>/<locale>/verify-email/<raw>` (and `/signin/magic/<raw>`, `/reset-password/<raw>`). The raw token rides in the URL path so it is never sent in a `Referer` header by the user's browser (path components are sent; query strings are sent too, so path is no better there, but path is the convention and is also not logged by typical web servers when access logs are off — the hosted instance will run access logs off in v0.1).

### 4.2 Hash-on-store policy

- The raw token is sent to the user once (email body + link) and never stored.
- The DB stores only `sha256(raw)` as the primary key. Compromise of the DB does not leak working tokens because the attacker would need a pre-image. Crucially, "never store raw" is enforced at the call boundary inside `@repo/auth`: `issueToken` returns `{ raw, hashed }` to the caller and writes only `hashed`; the surrounding flow (email send) consumes `raw` and discards it.

Illustrative type signature:

```ts
function issueToken(
  userId: string,
  purpose: TokenPurpose,
  payload: string | null,
  ttlSeconds: number,
): Promise<{ rawToken: string }>;

function consumeToken(
  rawToken: string,
  purpose: TokenPurpose,
): Promise<{ userId: string; payload: string | null } | null>;
```

`rawToken` leaves `issueToken` exactly once and is the caller's responsibility to put in an email and forget.

### 4.3 Single-use semantics

`consumeToken` is atomic delete-on-read, implemented as a single SQL statement:

```sql
DELETE FROM tokens
WHERE id = $1
  AND purpose = $2
  AND expires_at > now()
  AND consumed_at IS NULL
RETURNING user_id, payload;
```

The schema has a `consumed_at` column but the design treats it as belt-and-braces: the row is hard-deleted on consume, so the column is non-null only if a row was ever marked-but-not-deleted (an aborted transaction). Audits read deletions from the DB's WAL if needed.

A second call with the same raw token returns null — the row is gone. There is no resurrection path.

### 4.4 TTLs per purpose

| Purpose              | TTL          | Rationale                                                                                  |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `email_verification` | 24 hours     | Aligns with mail latency on bad networks; user has a working day to click.                 |
| `magic_link`         | 15 minutes   | Tight: magic links are bearer tokens that grant sign-in. Anything longer is unnecessary risk. |
| `password_reset`     | 60 minutes   | Long enough for "I asked, the mail was slow, I went to lunch" but short enough that a leaked inbox doesn't give a multi-day window. |

A user requesting the same purpose twice gets two separate rows; both remain valid until consumed or expired. We do not invalidate prior tokens on reissue — that opens a DoS where an attacker requests a token on behalf of a victim to invalidate the legitimate one. Instead, rate-limit reissues (Section 7).

### 4.5 Behavior matrix

| Token state                  | Detection                                                  | UI response                                                                                                    |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Valid                        | `consumeToken` returns `{ userId, payload }`               | Proceed with the action (verify, sign in, reset).                                                              |
| Invalid (no row)             | `consumeToken` returns null; cannot distinguish from used  | Generic "This link is no longer valid. Request a new one." with a button that re-runs the issue endpoint.       |
| Expired                      | Same — `consumeToken` returns null                         | Same generic message. We deliberately do not say "expired" vs "already used" to avoid signaling activity.       |
| Already consumed             | Same — row was deleted                                     | Same generic message.                                                                                          |
| Wrong purpose                | `consumeToken` returns null (purpose mismatch in WHERE)    | Same generic message.                                                                                          |

A single message ("This link is no longer valid") covers all four because they are indistinguishable to a well-behaved client and the security posture is "the link works once, then it doesn't, and we won't tell you why."

---

## 5. Password hashing

### 5.1 Algorithm and library

- Algorithm: **Argon2id**. Argon2id is OWASP's primary recommendation; Argon2d is GPU-hardened but vulnerable to side channels, Argon2i is side-channel-resistant but weaker against GPU. Argon2id hybridizes both.
- Library: `@node-rs/argon2` (MIT). Native Rust binding via N-API, multi-platform prebuilds, no `node-gyp` dance, no OpenSSL surface. Fits the corp-agnostic story (MIT, no service dependency). The dep is added to `packages/auth/package.json` by A-AUTH-1.

### 5.2 Parameters (OWASP 2024–2025)

OWASP publishes two profiles. We use the recommended profile for modern hardware, not the minimum:

| Parameter               | Value          | Notes                                                                                                                                        |
| ----------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `memoryCost` (KB)       | 65536 (64 MiB) | Modern recommended OWASP profile. The lower-bound profile is 19 MiB; 64 MiB is the "second profile" suitable for general-purpose backends.   |
| `timeCost` (iterations) | 3              | OWASP recommendation pairing with 64 MiB.                                                                                                    |
| `parallelism`           | 4              | OWASP recommendation pairing with 64 MiB. Matches the typical container vCPU count on the hosted instance and modest self-host VPS.          |
| `hashLength`            | 32 bytes       | Standard.                                                                                                                                    |
| `saltLength`            | 16 bytes       | Standard. Library generates per-hash.                                                                                                        |
| Encoded output          | PHC string     | `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>` — self-describing, future-proof under parameter change.                                       |

Verification latency target on a modest 2-vCPU instance: ~50–100 ms per `verifyPassword`. Sign-in rate limits (Section 7) keep this from being a DoS vector.

Illustrative signatures:

```ts
function hashPassword(plain: string): Promise<string>;       // returns PHC-encoded
function verifyPassword(plain: string, encoded: string): Promise<boolean>;
function needsRehash(encoded: string): boolean;              // true if params drift from current
```

### 5.3 Upgrade strategy

`hashPassword` always writes with the current params (read from a single source of truth in `packages/auth/src/password.ts`). `verifyPassword` parses the PHC string and accepts any historical params. On a successful sign-in:

```ts
if (await verifyPassword(plain, user.passwordHash) && needsRehash(user.passwordHash)) {
  const updated = await hashPassword(plain);
  await db.update(users).set({ passwordHash: updated }).where(eq(users.id, user.id));
}
```

This transparently migrates the corpus to new params over time without forced password resets. When params change in code, append the date and new values as a row to a parameter history table — wait, no: we do not need a table for this; the commit history of `packages/auth/src/password.ts` is the audit trail. Document the change in the same PR.

If we ever need to retire an algorithm entirely (e.g., move off Argon2id), `needsRehash` becomes `true` for any old encoded string, and the migration window relies on user sign-ins. Users who do not sign in within the window get force-reset emails. This is a v1+ concern; v0.1 ships only Argon2id.

---

## 6. CSRF strategy

Next.js Server Actions are the primary mutation channel. Server Actions in Next.js 16 enforce an Origin/Host check at the framework layer for any POST whose action target is a Server Action — the browser is forced to send a same-origin request, and a forged cross-origin form will be rejected before our code runs. That is our baseline.

### 6.1 Plain `<form action="POST">` fallback

Auth pages must work without JavaScript (per A-AUTH-3 acceptance criteria). Server Actions degrade to a plain POST whose body the framework reroutes; the Origin check still applies. But we also expose a small number of non-Server-Action endpoints under `apps/api` (e.g., the magic-link click target, which has to be a `GET` to satisfy email clients that pre-fetch). Those endpoints get explicit treatment per Section 6.3.

For traditional `<form method="POST">` against a route handler (none ship in v0.1 — every mutation is a Server Action — but the helper exists for B+ work), use the **double-submit cookie** pattern:

- On any GET that renders a form, `issueCsrfToken(sessionId)` writes a `csrf_token` cookie (NOT HttpOnly; the form's JS or the form itself must read it to submit it) and the same value is embedded as a hidden `<input name="csrf_token">`.
- On POST, the server compares the cookie value to the form value. Equal AND non-empty AND a valid HMAC of `sessionId + nonce` with a server secret → accept. Anything else → 403.

Illustrative signatures:

```ts
function issueCsrfToken(sessionId: string): string;                  // cookie value AND form value
function verifyCsrfToken(sessionId: string, submitted: string): boolean;
```

### 6.2 Token lifetime decision

- **Per-session** (the chosen approach): one CSRF token per session, embedded in every form. Validity ends when the session ends.
- Per-request was considered. Rejected: it requires either an extra round-trip on every form render or a complex token rotation scheme that breaks back-button POSTs. Per-session is the industry default for double-submit and the threat model (a malicious script needs both cookie + form value) is unchanged by rotation cadence.

Token is HMAC-SHA-256 of `sessionId` with a server secret (`CSRF_HMAC_SECRET`, env). Constant-time compare on verify. No DB row needed; the cookie + HMAC math is self-contained.

### 6.3 GET endpoints that mutate (magic-link click)

A magic-link click is a `GET` (because email clients pre-fetch and many users right-click) that consumes a single-use token and creates a session. This violates "GET is safe" by design. Mitigations:

- The action behind the GET is bound to the single-use token (Section 4.3 atomic consume); a pre-fetch by an email scanner consumes the token, the legitimate user gets the generic "no longer valid" message, and they request a new one.
- We mitigate the pre-fetch problem by routing the click target to an interstitial page (`/<locale>/signin/magic/<raw>`) that requires a `POST` confirmation. The GET only renders a "Confirm sign-in" button; the POST does the consume + session creation. Pre-fetch hits the GET, which is idempotent (it does not consume); only the explicit POST consumes. This adds one click but resolves the pre-fetch class entirely.

---

## 7. Rate limits

Implemented in A-RATE-1 against Redis (already in compose). The helper signature:

```ts
function limit(
  key: string,
  opts: { windowSec: number; max: number },
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }>;
```

Each row below maps to a call site. The key is the listed identifier; for combined keys (`ip+email`) the helper concatenates and hashes server-side. "IP" is the request IP after `X-Forwarded-For` consultation (config knob per A-RATE-1).

| Endpoint                                | Window | Max | Key                                       | Failure behavior                                                                          |
| --------------------------------------- | ------ | --- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /<locale>/signup`                 | 1 h    | 5   | `signup:ip:<ip>`                          | 429 with `Retry-After`; generic form error "Too many attempts; try again later."          |
| `POST /<locale>/signup`                 | 24 h   | 20  | `signup:ip:<ip>`                          | Second layer to slow long-tail abuse.                                                     |
| `POST /<locale>/signin` (password)      | 15 min | 10  | `signin:ip:<ip>` AND `signin:email:<email>` | Both keys checked; the lower remaining budget wins. Lockout is per-email-and-IP, not per-email alone, to defend against attacker DoS'ing victims. |
| `POST /<locale>/signin` (magic request) | 15 min | 5   | `magic:email:<email>` AND `magic:ip:<ip>` | Generic "Check your email" success message either way; the limit fires before any token is issued. |
| `POST /<locale>/forgot-password`        | 1 h    | 3   | `reset:email:<email>` AND `reset:ip:<ip>`| Same: success message either way; the limit fires before any token is issued.             |
| `GET /<locale>/verify-email/<token>`    | 1 h    | 30  | `verify:ip:<ip>`                          | 429; user sees "Too many attempts."                                                       |
| `POST /<locale>/verify-email/resend`    | 1 h    | 3   | `verify-resend:userId:<id>`               | Per-account, not per-IP (an unverified user might switch networks).                       |
| `POST /<locale>/reset-password`         | 1 h    | 10  | `reset-consume:ip:<ip>`                   | 429.                                                                                      |
| `POST /<locale>/account/handle-change`  | 30 d   | 1   | `handle:userId:<id>`                      | "You can change your handle again on <date>."                                             |
| `POST /<locale>/account/disable`        | 1 h    | 3   | `disable:userId:<id>`                     | Defensive against accidental rapid retries.                                               |

Notes:
- The `email`-keyed limits hash the email server-side with a project-wide salt before forming the Redis key; the limit table never holds plaintext emails.
- `ip+UA hash` was considered as a key to defeat shared NATs. Rejected for v0.1: User-Agent is trivially spoofed, the joint key would not raise the attacker bar meaningfully, and the operator's tolerance for shared-NAT false positives is acceptable at the chosen thresholds.
- Defaults documented here are mirrored as constants in `packages/auth/src/ratelimit-config.ts` (or equivalent) so a self-hoster can override via env without re-reading this doc.

---

## 8. Email transport

### 8.1 Default: SMTP via Nodemailer

- `nodemailer` (MIT) added to `@repo/notifications` by A-AUTH-2.
- Configuration from env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Dev resolves to MailHog (`localhost:1025`, no auth).
- Templates rendered with `react-email` + `@react-email/components` (both MIT). One render call produces both an HTML body and a plaintext alternative (`@react-email/render` `renderAsync({ html, text })`).
- Three templates land in A-AUTH-2: `verify-email.tsx`, `magic-link.tsx`, `password-reset.tsx`. Each accepts a `locale` prop and dispatches strings from a small per-template messages file under `packages/notifications/src/emails/messages/<locale>.ts`. RTL (Arabic) renders with `dir="rtl"` on the root container.

### 8.2 Optional: Resend adapter

A commented `ResendTransport` stub lives next to the SMTP transport. Switching is one env flag (`EMAIL_TRANSPORT=resend` + `RESEND_API_KEY`). The interface is symmetric:

```ts
interface MailTransport {
  send(message: { to: string; from: string; subject: string; html: string; text: string; headers?: Record<string, string> }): Promise<void>;
}
```

No public Resend code lands in v0.1 — only the documented escape hatch — to keep the default deployment SMTP-only and preserve the corp-agnostic stance.

### 8.3 Deliverability for the hosted instance

- **SPF**: `v=spf1 include:<smtp-provider>.com -all` published on the `earthropy.org` apex (or wherever the hosted instance lives).
- **DKIM**: 2048-bit key, selector `earthropy._domainkey`, signed by the SMTP relay. Verified via `dig TXT`.
- **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@<host>; pct=100`. Start at `quarantine` for v0.1; tighten to `reject` after one month of reports without false positives.
- **List-Unsubscribe headers**: every transactional email includes `List-Unsubscribe: <mailto:unsub@<host>?subject=...>, <https://<host>/<locale>/account/notifications/unsubscribe?t=<token>>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Note: transactional auth mail (verification, reset) is non-marketing and the one-click endpoint maps to the user's notification preferences for non-essential mail; verification mail cannot be unsubscribed because the account does not yet exist as a verified entity.
- **Return-Path**: bounce address routes to a `bounces@` mailbox monitored for high-bounce-rate disablement (not v0.1 automation; the hosted operator watches manually for the first month).
- Subject lines avoid the marketing tells that trip spam classifiers ("CLICK HERE", excessive punctuation, all caps); see template review checklist in A-AUTH-2.

---

## 9. Error model

Driving constraint: **never leak whether an email exists.** Sign-up, sign-in, magic-link request, and password-reset request all return the same surface to the client regardless of email state. Internal logs distinguish; user-facing UI does not.

| Condition                                         | HTTP | User-visible message                                                                  | Log level | Enumeration risk         |
| ------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- | --------- | ------------------------ |
| Sign-up: success                                  | 303  | "Check your email to verify."                                                          | info      | none                     |
| Sign-up: email already in use, verified           | 303  | Same: "Check your email to verify." (we send a "you already have an account; sign in or reset password" mail instead.) | info      | mitigated by identical UI |
| Sign-up: email already in use, unverified         | 303  | Same. (We re-issue a verification token, rate-limited per Section 7.)                  | info      | mitigated                |
| Sign-up: invalid email shape                      | 200  | "Enter a valid email address."                                                         | info      | none (no DB query)       |
| Sign-up: password fails complexity                | 200  | "Password must be at least 12 characters."                                             | info      | none                     |
| Sign-up: handle already taken                     | 200  | "That handle is taken. Try another."                                                   | info      | handle is public; ok     |
| Sign-up: rate-limited                             | 429  | "Too many attempts. Try again in <retryAfter> minutes."                                | warn      | none                     |
| Sign-in (password): success                       | 303  | (redirect to next or dashboard)                                                        | info      | none                     |
| Sign-in (password): wrong password OR no such user | 200 | "Email or password is incorrect."                                                      | info      | none                     |
| Sign-in (password): account disabled              | 200  | "Email or password is incorrect."                                                      | warn      | none (same as above)     |
| Sign-in (password): unverified email              | 200  | "Email or password is incorrect." We re-send the verification mail and ignore the password failure for logging. Alternative: a separate "verify your email" message — rejected for enumeration reasons. | warn | none |
| Sign-in (password): rate-limited                  | 429  | "Too many attempts. Try again in <retryAfter> minutes."                                | warn      | none                     |
| Magic link request: success OR unknown email      | 303  | "If an account exists for that email, we've sent a sign-in link."                      | info      | none                     |
| Magic link request: rate-limited                  | 429  | "Too many attempts. Try again later."                                                  | warn      | none                     |
| Magic link consume: valid token                   | 303  | (redirect to dashboard)                                                                | info      | none                     |
| Magic link consume: invalid/expired/used          | 200  | "This sign-in link is no longer valid. Request a new one."                             | info      | none                     |
| Password reset request: success OR unknown email  | 303  | "If an account exists for that email, we've sent a reset link."                        | info      | none                     |
| Password reset request: rate-limited              | 429  | "Too many attempts. Try again later."                                                  | warn      | none                     |
| Password reset consume: valid token + valid pw    | 303  | (redirect to dashboard, signed in)                                                     | info      | none                     |
| Password reset consume: invalid/expired/used      | 200  | "This reset link is no longer valid. Request a new one."                               | info      | none                     |
| Password reset consume: weak new password         | 200  | "Password must be at least 12 characters."                                             | info      | none                     |
| Verify email: valid token                         | 303  | (redirect to dashboard or sign-in if not currently signed in)                          | info      | none                     |
| Verify email: invalid/expired/used                | 200  | "This verification link is no longer valid. <Resend verification>."                     | info      | none                     |
| Handle change: invalid characters                 | 200  | "Handles use a–z, 0–9, hyphen, 3–30 characters."                                       | info      | none                     |
| Handle change: taken                              | 200  | "That handle is taken."                                                                | info      | handle is public; ok     |
| Handle change: rate-limited (30-day window)       | 429  | "You changed your handle recently. You can change it again on <date>."                 | info      | none                     |
| Account disable: success                          | 303  | (redirect to a goodbye page; cookie cleared)                                           | warn      | none                     |
| CSRF mismatch (route handler with double-submit)  | 403  | "Your form expired. Refresh the page and try again."                                   | warn      | none                     |
| Session missing/expired on a gated route          | 303  | (redirect to `/signin?next=<path>`)                                                    | info      | none                     |
| Server-side exception                             | 500  | "Something broke on our side. Try again in a minute."                                  | error     | none                     |

A "303 See Other" is the standard POST-redirect-GET pattern; the page that renders the result reads any flash state. "200" entries are the non-redirect responses that re-render the form with an inline error.

Constants for the user-visible strings live in `packages/i18n/src/messages/<locale>/auth.json` (one source per locale) and are referenced by message id; no inline English in the auth flows.

---

## 10. Database touchpoints

All touchpoints stay within the existing schema. No new tables, no new columns, no new indexes. The schema's existing indexes (`users_email_lower_uq`, `users_handle_lower_uq`, `sessions_user_idx`, `sessions_expires_idx`, `tokens_user_purpose_idx`) cover every query below.

### 10.1 `users`

| Operation                | SQL shape (illustrative)                                                                                          | Columns                                          | Transaction                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Sign-up: insert          | `INSERT INTO users (email, handle, display_name, locale, password_hash) VALUES (...)`                             | email, handle, display_name, locale, password_hash | Within the same TX as token issue (Section 10.3) so a failed token write rolls back the user.                |
| Sign-in lookup           | `SELECT id, email, handle, display_name, locale, reputation, password_hash, email_verified_at, disabled_at FROM users WHERE lower(email) = lower($1)` | full row                                         | autocommit                                                                                                   |
| Email verify             | `UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = $1 AND email_verified_at IS NULL`     | email_verified_at, updated_at                    | Within same TX as `consumeToken`.                                                                            |
| Password reset finalize  | `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`                                            | password_hash, updated_at                        | Within same TX as `consumeToken` + `DELETE FROM sessions WHERE user_id = $2`.                                |
| Locale change            | `UPDATE users SET locale = $1, updated_at = now() WHERE id = $2`                                                  | locale, updated_at                               | autocommit                                                                                                   |
| Handle change            | `UPDATE users SET handle = $1, updated_at = now() WHERE id = $2`                                                  | handle, updated_at                               | autocommit; uniqueness enforced by `users_handle_lower_uq`. Catches the constraint violation as "handle taken." |
| Display name change      | `UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`                                            | display_name, updated_at                         | autocommit                                                                                                   |
| Rehash on sign-in        | `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`                                            | password_hash, updated_at                        | autocommit, post-verifyPassword                                                                              |
| Account disable          | `UPDATE users SET disabled_at = now(), updated_at = now() WHERE id = $1`                                            | disabled_at, updated_at                          | Within same TX as `DELETE FROM sessions WHERE user_id = $1`.                                                 |

### 10.2 `sessions`

| Operation                  | SQL shape                                                                                                | Columns                                       | Transaction                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Create                     | `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_hash) VALUES (...)`                       | id, user_id, expires_at, user_agent, ip_hash  | autocommit when post-sign-in; in TX when post-verify/reset.          |
| Read with join             | `SELECT s.id, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1 AND s.expires_at > now() AND u.disabled_at IS NULL` | session + user                                | autocommit; runs on every authenticated request                      |
| Rotate                     | Atomic: `INSERT INTO sessions (new row) ... ; DELETE FROM sessions WHERE id = $oldId`                    | id, expires_at                                | single TX                                                            |
| List for user              | `SELECT id, expires_at, user_agent, ip_hash, created_at FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC` | session rows                                  | autocommit                                                           |
| Revoke single              | `DELETE FROM sessions WHERE id = $1 AND user_id = $2`                                                    | -                                             | autocommit                                                           |
| Revoke all-but-current     | `DELETE FROM sessions WHERE user_id = $1 AND id <> $2`                                                   | -                                             | autocommit                                                           |
| Revoke all                 | `DELETE FROM sessions WHERE user_id = $1`                                                                | -                                             | autocommit OR in TX with `users` update on password reset/disable    |
| GC expired (periodic)      | `DELETE FROM sessions WHERE expires_at <= now()`                                                         | -                                             | autocommit; ran as a worker (Phase B) or lazily on read              |

Indexes used: `sessions.id` (primary key) for read/rotate/revoke-single. `sessions_user_idx` for list-for-user and revoke-all. `sessions_expires_idx` for GC.

### 10.3 `tokens`

| Operation                  | SQL shape                                                                                                                              | Columns                                          | Transaction                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Issue                      | `INSERT INTO tokens (id, user_id, purpose, payload, expires_at) VALUES (sha256($raw), $userId, $purpose, $payload, now() + interval $ttl)` | id (hashed), user_id, purpose, payload, expires_at | Within same TX as the originating mutation (e.g., user insert for sign-up).       |
| Consume                    | `DELETE FROM tokens WHERE id = sha256($raw) AND purpose = $purpose AND expires_at > now() AND consumed_at IS NULL RETURNING user_id, payload` | -                                                | autocommit OR wrapping TX (when the consume is paired with `UPDATE users` for verify / reset). The outer TX runs the user update on the RETURNING row. |
| Per-user purpose lookup    | `SELECT count(*) FROM tokens WHERE user_id = $1 AND purpose = $2 AND expires_at > now()` (used by ratelimit `verify-resend`)            | -                                                | autocommit                                                                        |
| GC expired                 | `DELETE FROM tokens WHERE expires_at <= now() AND consumed_at IS NULL`                                                                 | -                                                | worker (Phase B) or lazily on consume                                             |

Indexes used: `tokens.id` (primary key) for consume. `tokens_user_purpose_idx` for the rate-limit count query.

### 10.4 No new indexes proposed

The schema's existing indexes cover every read path. The migration history is clean as of v0.1 and A-AUTH-1 should not add to it. If a slow query emerges in load testing, propose a new index in a follow-up — not in A-AUTH-1.

---

## 11. Test surface

### 11.1 Unit tests (A-AUTH-1; live under `packages/auth/src/`)

- `password.test.ts`
  - hashPassword → verifyPassword round-trip succeeds
  - hashPassword on the same plaintext twice produces different hashes (salt)
  - verifyPassword with wrong plaintext returns false
  - verifyPassword timing: average of N runs against correct vs wrong plaintext is within tolerance (constant-time-ish; this is a smoke check, not a formal proof)
  - needsRehash returns true for params drift; false for current params
  - sign-in rehash path: after a successful verify with old params, the stored hash on disk is replaced

- `sessions.test.ts`
  - createSession writes a row with the expected userAgent + ipHash + expiresAt
  - getSession returns the joined SessionUser for a live id
  - getSession returns null for an expired id (row present but expires_at < now)
  - getSession returns null for a revoked id (row deleted)
  - getSession returns null when the joined user is disabled
  - rotateSession returns a new id, deletes the old; getSession(oldId) → null, getSession(newId) → SessionUser
  - revokeSession(id) deletes the single row; revokeAllForUser(userId) deletes all sessions for that user
  - sessionCookie returns the expected attributes per env (Secure off in dev, on in prod)

- `tokens.test.ts`
  - issueToken returns a 43-char base64url raw; the stored id is sha256(raw) base64url
  - consumeToken with the matching raw returns `{ userId, payload }`
  - consumeToken with a different purpose returns null (the row is left intact)
  - consumeToken called twice returns null on the second call (single-use)
  - consumeToken returns null for an expired token (row present but expires_at past)
  - consumeToken returns null for an invalid (never-issued) raw
  - payload round-trips for `email_verification` carrying a new email for an email-change flow (v0.2+ but the column exists)

- `csrf.test.ts`
  - issueCsrfToken + verifyCsrfToken happy path
  - verifyCsrfToken with a tampered token returns false
  - verifyCsrfToken with a token issued under a different sessionId returns false
  - verifyCsrfToken uses constant-time compare (smoke check)

- `ratelimit.test.ts` (A-RATE-1)
  - First N requests under the threshold pass; the (N+1)th returns `{ ok: false, retryAfterSec > 0 }`
  - After windowSec elapses (use a clock fake), the budget resets
  - Two distinct keys do not share budget
  - Redis unavailable → fail-closed (return `{ ok: false }`) to defend against rate-limit bypass on infra glitches

### 11.2 E2E tests (A-AUTH-3 / A-AUTH-4; live under `e2e/`)

`e2e/auth.spec.ts` (Playwright; depends on X-PLAYWRIGHT-1):
- **Sign-up → verify → sign-in flow**: fill the sign-up form with a fresh email; intercept the MailHog API; extract the verify link; click it; assert dashboard render.
- **Magic-link sign-in**: existing verified user; request magic link; pull link from MailHog; click; assert dashboard.
- **Password reset round-trip**: request reset; pull link from MailHog; click; set new password; sign in with new password.
- **Wrong-password sign-in shows generic error and does not enumerate**: same error text whether the email exists or not. Assert by checking the error message DOM is byte-identical across the two probes.
- **Rate limit kicks in on sign-in**: 11 wrong-password POSTs against the same email; the 11th must render the rate-limit message.
- **Session persists across navigation; sign-out clears it**.
- **Magic-link interstitial is not auto-consumed by a GET**: simulate an email pre-fetcher that GETs the URL but does not POST; the link still works for the real user.

`e2e/account.spec.ts` (A-AUTH-4):
- Edit display name; locale change immediately updates UI to the new locale's strings.
- Active sessions list shows two rows after signing in from a second browser context; revoke the other; the other context's next request lands on `/signin`.
- Account disable flow: confirm prompt, then sign-in is blocked from the same email.

---

## 12. Open questions

None — all decisions resolved here.
