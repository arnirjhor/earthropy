---
id: B-GROUP-3
title: "Group browse with SDG facet filter"
status: done
priority: high
phase: B
agent_model: sonnet
deps: [B-GROUP-1]
tags: [groups, ui, pages]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Public group browse page at `/g` listing all public + listed groups with a SDG-chip filter row. Uses `listGroups` from `@repo/groups`.

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(public)/g/page.tsx` (under `(public)` because browse is unauthenticated).
- [ ] Filter row: 17 SDG color chips clickable as toggles; URL is the state (`?sdgs=1,7,13`), no client store. Plus a visibility filter (`?visibility=public|listed|both`, default `public`).
- [ ] Server-rendered list of groups using `AtlasCard` (already in `@repo/design-system`). Each card links to `/g/<slug>`.
- [ ] Pagination via `?cursor` (offset-based for v0.1: `?page=N`).
- [ ] Empty state: clear copy explaining what to do (no results, suggesting widening filters or creating a group).
- [ ] AAA contrast; RTL; axe-clean.

## Test plan
- `apps/app/src/app/[locale]/(public)/g/page.test.tsx` — URL → query params mapping; empty state renders.
- `e2e/group-browse.spec.ts` — create 3 groups across different SDGs → visit `/g` → filter by SDG 13 → assert correct group shows.

## Notes
- No new top-level deps. `AtlasCard` already supports `{ primarySdgId, memberCount }` props.
- The "memberCount" comes via a JOIN in `listGroups`; if the function doesn't return it, extend `listGroups` to optionally include it (this is the only allowed extension to @repo/groups in this task).
