---
id: B-GROUP-4
title: "Group detail page using AtlasCard patterns"
status: ready
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
Real group detail page at `apps/app/src/app/[locale]/(authenticated)/g/[slug]/page.tsx` (currently a placeholder from B-GROUP-2). Field-Record visual identity with the AtlasCard 6px top stripe; group header (name, SDG chips, description, member count, join/leave); posts list (uses `listPostsInGroup` from `@repo/posts`); CTA to create a post (for members).

## Acceptance criteria

- [ ] Replaces placeholder with full server component.
- [ ] Header: 6px primary-SDG-colored top rule (AtlasCard-style); name (Plex Sans display); SDG chip row; description; mono micro line "{N} MEMBERS · CREATED {dateFormat}".
- [ ] Join / Leave button (Server Action) for non-members / members; owners/moderators see role label + a "Manage" link to /g/<slug>/settings (stub page; full settings later).
- [ ] Posts list: server-fetched via `listPostsInGroup({ groupId, status: 'published', limit: 24 })`; renders each as a compact card with title, author, SDG chips, relative timestamp; clickable to /g/<slug>/p/<id>.
- [ ] "Create post" CTA visible to members; links to /g/<slug>/post/new.
- [ ] Empty state when no published posts: "No published posts yet."
- [ ] Visibility rule: private groups only render for members + viewers with invite tokens (defer invite tokens to B-GROUP-5; for v0.1 private groups 404 to non-members).
- [ ] AAA contrast; RTL; axe-clean.

## Test plan

- `page.test.tsx` — render with each visibility/membership combo.
- `e2e/group-detail.spec.ts` — sign in → create group → land on detail → create post → return → assert post appears.

## Notes

- Reuse the AtlasCard styling vocabulary; don't ship a new card.
- Join Server Action wraps `joinGroup` from B-GROUP-5 if landed; otherwise stub via direct insert into `group_members` and document the dep.
- No new top-level deps.
