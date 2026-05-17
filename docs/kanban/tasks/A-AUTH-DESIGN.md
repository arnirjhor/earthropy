---
id: A-AUTH-DESIGN
title: "Architect: @repo/auth design doc"
status: ready
priority: critical
phase: A
agent_model: opus
deps: []
tags: [auth, architecture, security]
owner: ""
branch: ""
pr: ""
estimated_hours: 1
created: 2026-05-18
updated: 2026-05-18
---

## Description
Produce a precise design document for the authentication subsystem before any code lands. The Architect should walk the entire identity lifecycle (sign-up → email verify → sign-in via password OR magic link → session refresh → password reset → account deletion) and specify every primitive: token shapes, cookie names + attributes, hash parameters, table indexes, error responses, abuse-prevention knobs.

Output is a markdown design doc — no code.

## Acceptance criteria
- [ ] `docs/architecture/auth.md` exists with the following sections:
  - Identity lifecycle (state machine diagram in ASCII)
  - Tokens (shape, entropy bits, hash-on-store policy, expiry, single-use semantics)
  - Sessions (cookie name, attributes, rotation policy, idle vs absolute expiry, "active sessions" UX)
  - Password hashing (Argon2id parameters: memory, parallelism, iterations — OWASP 2025 recommended)
  - CSRF strategy (Server Action implicit + double-submit fallback for plain forms)
  - Rate limits (per-endpoint thresholds: sign-up, sign-in, magic-link request, password reset)
  - Email transport pluggability (SMTP default, Resend optional)
  - Error model (which conditions return what code; never leak whether email exists)
  - Database touchpoints (existing tables `users`, `sessions`, `tokens` from `packages/database/src/schema/`)
  - Test surface (what unit tests, what e2e tests)
- [ ] The doc cites the existing schema and references the relevant files by path.
- [ ] No code beyond illustrative type signatures.

## Test plan
- (N/A — design doc.)

## Notes
This is the Architect-tier task. Reviewers (when A-AUTH-1 lands) check that the implementation matches this doc. Deviations during implementation get logged in the doc, not invented silently.
