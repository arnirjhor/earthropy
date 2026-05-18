---
id: D-RTL-1
title: "Full RTL audit + fixes"
status: done
priority: high
phase: D
agent_model: sonnet
deps: []
tags: [a11y, rtl, i18n]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Switch locale to Arabic and audit every page for RTL correctness. Fix layout issues, ensure logical properties are used (margin-inline-start not margin-left), icons don't flip incorrectly, and text alignment is correct.

## Acceptance criteria

- [x] All pages render correctly in RTL (ar locale).
- [x] CSS uses logical properties throughout.
- [x] Directional icons (arrows, chevrons) flip correctly.
- [x] No text overflow or layout breakage in RTL.
- [x] `pnpm typecheck` green (pre-existing unrelated failure in g/page.tsx excluded).

## Completion note

Audited all 65 TSX files in `apps/app/src/` and all TSX files in `packages/design-system/src/components/`, plus the globals CSS.

Fixes applied across 4 files:
- `_sessions.tsx`: `ml-` → `ms-`
- `_notifications.tsx`: `text-left`/`pr-` → `text-start`/`pe-` (2 occurrences)
- `sheet.tsx`: `right-4` → `end-4` (close button), `sm:text-left` → `sm:text-start`
- `dialog.tsx`: `right-4` → `end-4` (close button), `sm:text-left` → `sm:text-start`

No directional icons found in codebase — no flip fixes needed. Full audit documented in `docs/a11y-rtl-audit.md`.
