---
id: D-SR-1
title: "Screen-reader pass (VoiceOver script, NVDA notes)"
status: done
priority: high
phase: D
agent_model: sonnet
deps: []
tags: [a11y, screen-reader]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Ensure all pages have proper ARIA landmarks, labels, and live regions. Document a VoiceOver testing script. Fix any issues found.

## Acceptance criteria

- [x] Every page has `<main>`, `<nav>`, `<header>` landmarks.
- [x] All images have alt text (or aria-hidden if decorative).
- [x] All form inputs have associated labels.
- [x] Live regions for dynamic content (toast notifications, moderation status changes).
- [x] `docs/a11y-voiceover-script.md` documents the testing flow.
- [x] `pnpm typecheck` green.

## Completion note

Full screen-reader audit completed 2026-05-18. Fixes applied across 10+ files:
- Added skip-to-content link in `apps/app/src/app/[locale]/layout.tsx`
- Added `id="main-content"` to all `<main>` elements (dashboard, post detail, SDG hub, notifications, account, group pages)
- Added `aria-label` to all context-dependent buttons: Join/Leave group, Promote/Demote/Transfer member roles, mark-all-as-read (notifications bell and notifications page), mark-all-as-read (account)
- Fixed tab widget in new-post form: added `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`, `aria-labelledby`, `hidden` attribute
- Added `aria-live="polite"` to notifications dropdown list
- Added `scope="col"` to all `<th>` in account notifications preferences table; added `aria-label` on table
- Added `role="status" aria-live="polite"` / `<output>` to success messages in account settings form
- Added `aria-label` on account and sidebar navigation elements
- `pnpm typecheck` — 0 errors. `pnpm lint` — 0 new errors (1 pre-existing `noExplicitAny` in e2e spec, unrelated).
- `docs/a11y-voiceover-script.md` created with 13-page test flow, NVDA notes, RTL notes, and regression checklist.
