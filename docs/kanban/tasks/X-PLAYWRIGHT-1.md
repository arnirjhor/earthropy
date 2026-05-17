---
id: X-PLAYWRIGHT-1
title: "Playwright config + first e2e on apps/web landing"
status: ready
priority: critical
phase: X
agent_model: sonnet
deps: []
tags: [tooling, tests, e2e, foundation]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Stand up Playwright + axe-core so every UI Builder can ship a passing e2e + accessibility check. Wire the `test:e2e` task into Turbo. Demonstrate with one passing smoke test against `apps/web`'s landing page.

## Acceptance criteria
- [ ] `@playwright/test` and `@axe-core/playwright` in root `devDependencies`.
- [ ] Root `playwright.config.ts` with `webServer` autostarting `pnpm --filter @earthropy/web dev` with `env: { WEB_PORT: '3011' }` and `url: 'http://localhost:3011/en'`. The test config itself targets port 3011 so a developer running the normal `pnpm dev` (web on 3001) is undisturbed.
- [ ] `pnpm exec playwright install --with-deps chromium` documented in `docs/kanban/_conventions.md` (one-time setup).
- [ ] Root `test:e2e` script: `playwright test`; wired into `turbo.json` (cache: false, persistent: false).
- [ ] One real test: `e2e/landing.spec.ts` asserts the Plex Sans display headline is visible and the SDG color bar is present.
- [ ] One a11y assertion: axe finds zero `serious` or `critical` violations on the landing.
- [ ] `pnpm test:e2e` exits 0 (Playwright starts its own dev server on 3011; doesn't touch any existing dev process).

## Test plan
- `e2e/landing.spec.ts`
  - "renders the hero headline" — locator for the display-class heading is visible
  - "shows the 17-cell SDG color bar" — 17 cell elements present in DOM order
  - "passes axe a11y check (no serious/critical)" — `new AxeBuilder({ page }).analyze()` → zero matching violations

## Notes
Playwright's webServer must use a port distinct from the default `apps/web` dev port (3001) so the test harness does not race or kill a running developer dev server. We standardize on 3011 here; CI can use 3001 since no human dev server is present.
