---
id: X-CI-1
title: ".github/workflows/ci.yml — typecheck, lint, test, e2e on PR"
status: blocked
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
updated: 2026-05-18
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
Blocked until X-GH-1 lands (need the remote first).
