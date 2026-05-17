---
id: B-COMMENT-1
title: "Comments CRUD + threaded model"
status: ready
priority: high
phase: B
agent_model: sonnet
deps: [B-POST-1]
tags: [comments, community, server-actions, db]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
New `@repo/comments` package mirroring `@repo/posts`'s shape. Schema (`comments` table, `parent_comment_id` for threading) already exists; no migrations.

## Acceptance criteria

- [ ] `@repo/comments` package created with package.json + tsconfig + vitest.config.
- [ ] `createComment({ postId, authorId, parentCommentId?, body, locale })` — inserts with `status='pending_ai'`; rejects if parent comment is on a different post.
- [ ] `getCommentById(id)`, `listCommentsForPost(postId, { status?, limit, offset })` returns ordered tree (parent_comment_id null first, children by created_at).
- [ ] `updateCommentStatus(id, newStatus, { actorId })` — same state-machine semantics as posts: `pending_ai → pending_review → published / rejected / withdrawn`. Reuse pattern from `@repo/posts/src/updatePostStatus.ts`.
- [ ] `withdrawComment(id, actorId)` — author-only.
- [ ] Server Actions in `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/_actions.ts`: `createCommentAction`, `withdrawCommentAction`. Rate-limited.
- [ ] No UI in this task — thread component lands in B-COMMENT-2.

## Test plan
- `packages/comments/src/createComment.test.ts` — happy + threading (parent on same post) + reject (parent on different post).
- `packages/comments/src/listCommentsForPost.test.ts` — flat list ordered correctly; tree shape derivation.
- `packages/comments/src/updateCommentStatus.test.ts` — legal/illegal transitions.

## Notes
- No new top-level deps.
- The `posts` state-machine pattern is the template; copy structure not contents.
