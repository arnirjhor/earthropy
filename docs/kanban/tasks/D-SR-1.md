---
id: D-SR-1
title: "Screen-reader pass (VoiceOver script, NVDA notes)"
status: ready
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

- [ ] Every page has `<main>`, `<nav>`, `<header>` landmarks.
- [ ] All images have alt text (or aria-hidden if decorative).
- [ ] All form inputs have associated labels.
- [ ] Live regions for dynamic content (toast notifications, moderation status changes).
- [ ] `docs/a11y-voiceover-script.md` documents the testing flow.
- [ ] `pnpm typecheck` green.
