---
id: B-REP-1
title: "Reputation accrual wiring + history page"
status: done
priority: high
phase: B
agent_model: sonnet
deps: [B-POST-1, B-COMMENT-1]
tags: [trust, reputation, ui]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Wire `@repo/trust`'s deltas into the actual flow. When a post or comment transitions to `published`, the author gets `+5` / `+1`. When `rejected`, `-3` / `-1`. Reputation is recomputed by summing `reputation_events`; the cached `users.reputation` is updated atomically. A user-visible "Reputation history" page at `/u/<handle>/reputation` shows their event log.

## Acceptance criteria

- [ ] New `@repo/trust` function: `recordEvent({ userId, kind, sourceId, reason })` inserts a `reputation_events` row and updates `users.reputation` in a transaction.
- [ ] Hooked into `apps/api/src/workers/moderation.ts` — when transitioning a post/comment to `published`/`rejected`, call `recordEvent` with the matching `reputationKind`.
- [ ] Hooked into `withdrawPost` / `withdrawComment` (optional — defer; don't penalize voluntary withdrawal).
- [ ] Page at `apps/app/src/app/[locale]/u/[handle]/reputation/page.tsx` — public (anyone can see anyone's reputation history). Lists events with kind, delta, source link (if resolvable), timestamp. Pagination.
- [ ] Tier badge surfaces in the user header (Plex Mono small caps, neutral color — no flashy chrome).
- [ ] Account settings page already exists; add the current tier + reputation count to the profile section.

## Test plan

- `packages/trust/src/recordEvent.test.ts` — inserts row + updates `users.reputation` atomically; concurrent events sum correctly.
- `apps/app/src/app/[locale]/u/[handle]/reputation/page.test.tsx` — renders empty + with-events.
- `e2e/reputation.spec.ts` — sign in → create post → MODERATION_DISABLED=1 to fast-publish → assert reputation increased by 5.

## Notes

- The reputation column on `users` is denormalized for fast reads; ground truth is the events table.
- No new top-level deps.
- Don't add comment-on-published reactions / upvotes — those are v0.2.
