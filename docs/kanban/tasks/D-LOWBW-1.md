---
id: D-LOWBW-1
title: "No-JS read path + lazy images + image budget"
status: ready
priority: medium
phase: D
agent_model: sonnet
deps: []
tags: [a11y, performance]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Ensure public pages are readable without JavaScript. Add lazy loading to all images. Set image size budgets. Test on simulated slow 3G.

## Acceptance criteria

- [ ] Public routes (/, /g, /sdg/*, /transparency) render meaningful content with JS disabled.
- [ ] All `<img>` tags use `loading="lazy"` (except above-the-fold).
- [ ] Next.js Image component used where applicable with width/height.
- [ ] `pnpm typecheck` green.
