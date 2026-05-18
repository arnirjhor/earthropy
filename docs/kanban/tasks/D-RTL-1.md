---
id: D-RTL-1
title: "Full RTL audit + fixes"
status: ready
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

- [ ] All pages render correctly in RTL (ar locale).
- [ ] CSS uses logical properties throughout.
- [ ] Directional icons (arrows, chevrons) flip correctly.
- [ ] No text overflow or layout breakage in RTL.
- [ ] `pnpm typecheck` green.
