---
id: D-KEYBOARD-1
title: "Keyboard navigation audit + fixes"
status: done
priority: high
phase: D
agent_model: sonnet
deps: []
tags: [a11y, keyboard]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Audit every interactive page for keyboard navigation. Focus ring must be visible. Tab order must be logical. All interactive elements reachable. Escape closes modals/sheets. Enter activates buttons/links.

## Acceptance criteria

- [x] Every button, link, input, and dialog is keyboard-reachable with visible focus ring.
- [x] Tab order follows visual layout (no tabindex > 0).
- [x] Modals trap focus and Escape closes them.
- [x] No keyboard traps.
- [x] `pnpm typecheck` green.

## Completion note

Full audit of all interactive components across `packages/design-system/` and `apps/app/src/`. Fixes applied:
- Skip-to-content link added to root layout; `id="main-content"` added to all 23 `<main>` elements.
- `focus:` → `focus-visible:` on textarea and select elements in `_appeal-form.tsx`, `_reply.tsx`, `_form.tsx` (account), `members/page.tsx`.
- `focus-visible:outline` added to buttons missing it: appeal trigger/submit/cancel, reply trigger/submit/cancel, withdraw buttons (post + comment), notifications bell dropdown buttons, members page action buttons, post editor Write/Preview tabs, AtlasCard link, SdgColorBar cell links.
- Escape key closes NotificationsBell dropdown.
- `<p role="status">` → `<output>` for Biome `useSemanticElements` compliance in account `_form.tsx`.
- `pnpm typecheck` and `pnpm lint` both pass.
- Full audit documented in `docs/a11y-keyboard-audit.md`.
