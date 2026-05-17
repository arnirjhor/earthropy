---
id: X-VITEST-1
title: "Vitest config + first cross-package smoke test"
status: ready
priority: critical
phase: X
agent_model: sonnet
deps: []
tags: [tooling, tests, foundation]
owner: ""
branch: ""
pr: ""
estimated_hours: 1
created: 2026-05-18
updated: 2026-05-18
---

## Description
Stand up Vitest at the root so every subsequent Builder can write a failing test first (TDD discipline gate). Wire the `test` task into Turbo. Demonstrate it works by writing one passing smoke test in `@repo/sdg` (the cheapest pure-logic package) — `getSdgById(13)` returns the Climate Action row.

## Acceptance criteria
- [ ] `vitest` and `@vitest/coverage-v8` declared in root `devDependencies` (vetted-allowlist deps).
- [ ] Root `vitest.config.ts` configured with workspace-aware projects (one project per `apps/*` and `packages/*` with tests).
- [ ] Each package that needs tests gets a `"test": "vitest run"` and `"test:watch": "vitest"` script in its `package.json`.
- [ ] Root `package.json` already has `"test": "turbo run test"` — verify it routes correctly.
- [ ] `turbo.json` `test` task exists with `outputs: ["coverage/**"]` — verify.
- [ ] One real test: `packages/sdg/src/sdgs.test.ts` covers `getSdgById`, `getSdgByCode`, and an `isSdgId` guard case.
- [ ] `pnpm test` from root exits 0 with the smoke test passing.

## Test plan
- `packages/sdg/src/sdgs.test.ts`
  - `getSdgById(13)` returns `{ code: 'climate-action', color: '#3F7E44', ... }`
  - `getSdgByCode('partnerships-for-the-goals')` returns id 17
  - `isSdgId(18)` is false; `isSdgId(1)` is true

## Notes
TDD discipline for THIS task: write the three assertions, confirm they fail with "vitest: command not found" or similar pre-install state, install vitest, re-run, confirm green. Commit tests + config separately.
