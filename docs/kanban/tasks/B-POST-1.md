---
id: B-POST-1
title: "Posts CRUD + status state machine"
status: ready
priority: critical
phase: B
agent_model: sonnet
deps: [B-GROUP-1]
tags: [posts, community, server-actions, db]
owner: ""
branch: ""
pr: ""
estimated_hours: 4
created: 2026-05-18
updated: 2026-05-18
---

## Description
New `@repo/posts` package (mirroring `@repo/groups`'s shape) wraps the existing `posts` + `post_sdgs` schema with a pure-logic data layer and the related Server Actions. Implements the **status state machine**:

```
pending_ai ─(moderation verdict)─▶ published | pending_review | rejected
pending_review ─(human override)─▶ published | rejected
published ─(author withdraw)─▶ withdrawn
rejected ─(appeal upheld)──▶ published
```

The pipeline that drives `pending_ai → verdict` lives in `C-PIPE-1`. This task just creates the post in `pending_ai` and exposes the action-layer hooks that the pipeline will later call.

Schema already exists in `packages/database/src/schema/posts.ts`. **No new schema, no migrations.**

## Acceptance criteria

- [ ] New `@repo/posts` package with same shape as `@repo/groups`.
- [ ] `createPost({ groupId, authorId, title, body, locale, sdgIds })` — wraps insert + `post_sdgs` M2M in one transaction; sets status to `pending_ai` (no inline moderation yet — that lands in C-PIPE-1; this task just produces the row).
- [ ] `getPostById(id)` / `getPostBySlug(...)` if a slug exists (the schema has no slug column; use UUID).
- [ ] `listPostsInGroup({ groupId, status?, limit, offset })` — paginated; default status filter to `published` for non-moderator viewers (the caller passes the right filter; this function doesn't enforce auth).
- [ ] `listPostsForFeed({ userId, sdgIds?, limit, offset })` — joins via `group_members` and optional SDG filter; used by the dashboard later.
- [ ] `updatePostStatus(id, { newStatus, reason?, actorId? })` — state-machine transitions only; rejects invalid transitions. Records the `status_reason` and sets `published_at` when transitioning into `published`.
- [ ] `withdrawPost(id, actorId)` — only the author can withdraw; transitions to `withdrawn`.
- [ ] Server Actions in `apps/app/src/app/[locale]/(authenticated)/p/_actions.ts`: `createPostAction`, `withdrawPostAction`. Rate-limited per `auth.md` §7 thresholds (post-create is the heavy one).
- [ ] All transitions emit a `posts.statusChanged` event-like helper (just a synchronous function call for now) — used by B-NOTIF-1 + C-PIPE-1 later.

## Test plan

- `packages/posts/src/createPost.test.ts` — happy path with N SDG tags; SDG tags must include the group's primary SDG (validation); transaction rollback on bad SDG id.
- `packages/posts/src/updatePostStatus.test.ts` — every legal transition succeeds; every illegal transition throws a typed `IllegalTransitionError`; `published_at` set correctly.
- `packages/posts/src/withdrawPost.test.ts` — author can withdraw; non-author cannot.
- `packages/posts/src/listPosts.test.ts` — feed query joins through `group_members` correctly; SDG filter narrows.

## Notes

- Posts are draft-free in v0.1 — submit goes straight to `pending_ai`. Draft posts can be a v0.2 feature.
- Status transitions are enforced in code, not via a DB CHECK constraint, so the function is the only safe write path.
- No UI here. Forms land in `B-POST-2`; detail page in `B-POST-3`.
- Do not add new top-level deps; reuse Drizzle + Zod (apps/app's dep).
