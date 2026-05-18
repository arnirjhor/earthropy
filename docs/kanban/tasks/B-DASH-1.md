---
id: B-DASH-1
title: "Personal dashboard — joined groups + followed SDGs feed"
status: done
priority: high
phase: B
agent_model: sonnet
deps: [B-GROUP-1, B-POST-1]
tags: [dashboard, ui, pages]
owner: ""
branch: ""
pr: ""
estimated_hours: 4
created: 2026-05-18
updated: 2026-05-18
---

## Description
The first page an authenticated user sees after sign-in. Currently a placeholder at `apps/app/src/app/[locale]/(authenticated)/dashboard/page.tsx`. Replace with a real dashboard: a personalized feed combining recent posts from the user's joined groups + followed SDGs, plus a left rail of the user's groups and a "SDGs you follow" widget.

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(authenticated)/dashboard/page.tsx` — server component, fully replaces the placeholder.
- [ ] Layout: two columns (responsive: stacks on mobile / RTL flips left-right).
  - Left rail: "Your groups" — list of AtlasCards (compact) for groups the user is a member of (max 8 with "see all" → /g). Below it: "SDGs you follow" — 17-chip grid with the followed ones highlighted; clicking toggles follow via Server Action.
  - Main column: "Your feed" — posts from joined groups + posts tagged with followed SDGs (deduped), status=published, ordered by published_at desc, 25 per page.
- [ ] `listPostsForFeed` from `@repo/posts` returns the feed; if it doesn't yet handle the SDG-follow join, extend it.
- [ ] "Follow SDG" Server Action — inserts/deletes `user_followed_sdgs` row.
- [ ] Empty state when feed is empty: clear copy + CTAs ("Join a group" → /g; "Follow some SDGs" → highlight the chip rail).
- [ ] AAA contrast; RTL; axe-clean.

## Test plan

- `page.test.tsx` — empty state; with-feed render; SDG follow toggle.
- `e2e/dashboard.spec.ts` — sign in → join a group → create a post → land on dashboard → post visible in feed.

## Notes

- The schema's `user_followed_sdgs` table is already in place (`packages/database/src/schema/users.ts`).
- The feed query is the heaviest one in v0.1; cap N at 25 and add an index hint only if profiling shows need (don't preemptively).
- Reuse the compact PostCard from B-GROUP-4.
- No new top-level deps.
