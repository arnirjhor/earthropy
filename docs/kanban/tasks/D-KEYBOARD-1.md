---
id: D-KEYBOARD-1
title: "Keyboard navigation audit + fixes"
status: ready
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

- [ ] Every button, link, input, and dialog is keyboard-reachable with visible focus ring.
- [ ] Tab order follows visual layout (no tabindex > 0).
- [ ] Modals trap focus and Escape closes them.
- [ ] No keyboard traps.
- [ ] `pnpm typecheck` green.
