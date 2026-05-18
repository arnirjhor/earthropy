---
id: F-SEED-17
title: "Seed 17 official SDG groups"
status: ready
priority: medium
phase: F
agent_model: sonnet
deps: [F-DEPLOY-VERCEL]
tags: [data, sdg]
owner: ""
branch: ""
pr: ""
estimated_hours: 1
created: 2026-05-18
updated: 2026-05-18
---

## Description
Create a seed script that inserts 17 official groups, one per SDG, tagged with the corresponding SDG. These serve as the default community hubs.

## Acceptance criteria

- [ ] Seed script at `packages/database/src/seed-groups.ts`.
- [ ] 17 groups created with official SDG names.
- [ ] Each group tagged with its corresponding SDG.
- [ ] Script is idempotent (safe to re-run).
