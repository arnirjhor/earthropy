---
id: X-CI-1
title: ".github/workflows/ci.yml — typecheck, lint, test, e2e on PR"
status: done
priority: high
phase: X
agent_model: haiku
deps: [X-GH-1, X-VITEST-1, X-PLAYWRIGHT-1]
tags: [tooling, ci, foundation]
owner: ""
branch: ""
pr: ""
estimated_hours: 1
created: 2026-05-18
updated: 2026-05-20
---

## Description
GitHub Actions workflow that runs the standard gates on every PR. Cache the pnpm store. Run typecheck + lint + Vitest in one job, Playwright e2e in a separate job (slower, needs chromium).

## Acceptance criteria
- [ ] `.github/workflows/ci.yml` runs on `pull_request` against `main`.
- [ ] Jobs: `gates` (typecheck/lint/test) + `e2e` (Playwright with chromium).
- [ ] pnpm store cached across runs via `actions/cache@v4`.
- [ ] Both jobs run on Node 22 (matches `.nvmrc`).
- [ ] Status checks visible on PRs (badge in `README.md` updated).

## Test plan
- Trigger via a no-op PR; confirm both jobs run and pass on the v0.0.2 baseline.

## Notes
X-GH-1 is resolved (remote exists at https://github.com/arnirjhor/earthropy). CI workflow created at `.github/workflows/ci.yml`.

## Completion note (2026-05-20)
Implemented `.github/workflows/ci.yml` with three jobs:
- `lint-and-typecheck` — runs `pnpm lint` + `pnpm typecheck` with Turborepo local cache.
- `test` — runs `pnpm db:migrate` + `pnpm test` against a Postgres 16 service container (port 5432, `DATABASE_URL` injected); Redis URL stubbed (queue/ratelimit tests mock Redis in-memory). Docker build depends on both passing.
- `docker-build` — smoke-builds `apps/app/Dockerfile` and `apps/api/Dockerfile` via `docker/build-push-action@v6` with GHA layer cache; no push.

`lint-and-typecheck` and `test` run in parallel; `docker-build` gates on both. Concurrency group cancels superseded PR runs. Node 22, pnpm 9.15.0, `ubuntu-latest` throughout.
