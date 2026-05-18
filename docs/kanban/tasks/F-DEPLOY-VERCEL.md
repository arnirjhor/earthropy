---
id: F-DEPLOY-VERCEL
title: "Deploy hosted instance to Vercel"
status: done
priority: high
phase: F
agent_model: sonnet
deps: [E-COMPOSE-PROD]
tags: [deploy]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Configure Vercel deployment for `apps/app` and `apps/web`. Set up environment variables, build settings, and domain configuration.

## Acceptance criteria

- [ ] `vercel.json` or project settings configured for monorepo.
- [ ] Both apps deploy successfully.
- [ ] Environment variables documented.

## Notes
- Requires X-GH-1 (GitHub remote) first.

## Completion

- Created `apps/app/vercel.json` with monorepo turbo build command, `iad1` region, and all required env var references.
- `next.config.ts` already had `output: 'standalone'` and full `transpilePackages` list — no changes needed.
- Created `docs/deploy-vercel.md` covering prerequisites, import steps, all env vars, preview deployments, and API deployment note.
- Verified no hardcoded localhost URLs — the one instance in `auth.ts` is correctly guarded by `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`.
- All env vars (`DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, etc.) are read from `process.env`.
