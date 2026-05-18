---
id: C-QUEUE-UI-1
title: "Moderator queue UI"
status: done
priority: high
phase: C
agent_model: sonnet
deps: [C-PIPE-1]
tags: [moderation, ui, pages]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
The moderator's working surface. Lists posts + comments with `status='pending_review'` for groups the moderator (or platform anchor) has authority over. Each row shows author, content preview, the AI's reasoning + scores, action buttons: Publish, Reject (with optional reason), Hold (do nothing for now).

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(authenticated)/moderation/page.tsx`.
- [ ] Auth: viewer must be a `group_members.role IN ('owner','moderator')` of at least one group OR a platform anchor (reputation ≥ 2000 per `@repo/trust`).
- [ ] Lists `posts` + `comments` with `status='pending_review'` filtered to groups where the viewer has authority. For platform anchors, all `pending_review` items.
- [ ] Each row shows: type (post/comment), group name, author handle, content preview (200 chars), the latest `moderation_decisions` row (reasoning + scores formatted as a small table), age.
- [ ] Action Server Actions: `moderatorPublishAction(targetType, targetId, reason?)`, `moderatorRejectAction(targetType, targetId, reason)`. Each writes a new `moderation_decisions` row with `verdict='human_publish' | 'human_reject'`, `reviewerId=actor`, then transitions status.
- [ ] Pagination via `?page=N`; 50 rows per page.
- [ ] Empty state: "No items to review."
- [ ] AAA contrast; keyboard navigable; RTL works.

## Test plan

- `page.test.tsx` — auth gating; renders pending items; action buttons present.
- `_actions.test.ts` — moderator publish writes audit row + transitions status; non-moderator rejected.
- `e2e/moderation-queue.spec.ts` — moderator signs in → submits a hold-worthy post → it appears in queue → moderator publishes → post is published.

## Notes

- Don't refactor the existing post detail's status banner — that's the *author*'s view. This is the *moderator*'s queue.
- Reuse `SdgChip` and existing card patterns. No new design.
- No new top-level deps.
