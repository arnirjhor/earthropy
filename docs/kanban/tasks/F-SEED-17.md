---
id: F-SEED-17
title: "Seed 17 official SDG groups"
status: done
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

- [x] Seed script at `packages/database/src/seed-groups.ts`.
- [x] 17 groups created with official SDG names.
- [x] Each group tagged with its corresponding SDG.
- [x] Script is idempotent (safe to re-run).

## Completion note

`packages/database/src/seed-groups.ts` created. Upserts a fixed-UUID system user
(`00000000-0000-0000-0000-000000000001`) then inserts 17 public groups via
`onConflictDoNothing` on slug, then links each group to its SDG in `group_sdgs`.
Run with `pnpm db:seed-groups` (root) or `pnpm --filter @repo/database seed-groups`.
