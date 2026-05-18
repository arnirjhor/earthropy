---
id: A-RATE-1
title: "Redis-backed rate limiting middleware (apps/api + apps/app)"
status: done
priority: high
phase: A
agent_model: sonnet
deps: [A-AUTH-1]
tags: [security, infra]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
A small rate-limiting helper backed by Redis (already in compose). Applied to expensive endpoints: sign-in, sign-up, magic-link request, password reset, post create, comment create. Window + max via config per endpoint.

## Acceptance criteria
- [ ] `@repo/auth` (or a new `@repo/ratelimit`) exposes `limit(key: string, opts: { windowSec, max })`. Implementation: Redis `INCR` + `EXPIRE`.
- [ ] Middleware wrappers for Next.js Server Actions + API routes.
- [ ] Honors `X-Forwarded-For` correctly when behind a proxy (config knob).
- [ ] Failed limit returns 429 with `Retry-After` header.
- [ ] Defaults documented in `docs/architecture/auth.md`.

## Test plan
- `packages/auth/src/ratelimit.test.ts` — mocked Redis: first N below threshold pass; N+1 returns 429; window resets after TTL.

## Notes
Don't introduce upstash or hosted-only Redis adapters; pure `ioredis` against the local/self-host Redis.
