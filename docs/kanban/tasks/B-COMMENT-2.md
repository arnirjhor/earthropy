---
id: B-COMMENT-2
title: "Comments thread component + reply form"
status: ready
priority: high
phase: B
agent_model: sonnet
deps: [B-COMMENT-1, B-POST-3]
tags: [comments, ui]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Threaded comments UI rendered into the post detail page (B-POST-3). Server-side renders the full thread; a per-comment "Reply" button progressively-enhances to inline a small reply form.

## Acceptance criteria

- [ ] New component `apps/app/src/app/[locale]/(authenticated)/g/[slug]/p/[id]/_thread.tsx` (server) + `_reply.tsx` (client for inline reply form).
- [ ] Fetches via `listCommentsForPost` from `@repo/comments`; derives the tree client-side from the flat ordered list.
- [ ] Render: each comment shows author handle, relative timestamp (use `Intl.RelativeTimeFormat`), body (sanitized markdown), status indicator if not `published` (per the visibility rules from B-POST-3 for the viewer).
- [ ] Top-level reply form posts via `createCommentAction` with no `parent_comment_id`.
- [ ] Per-comment Reply button → expands the inline reply form (`parent_comment_id` pre-filled) — works with or without JS (the form action attribute defaults to the same Server Action URL).
- [ ] Withdraw button visible to author of published comments.
- [ ] Inserted into the B-POST-3 post detail page below the post body.
- [ ] AAA contrast, axe-clean, RTL works.

## Test plan
- `apps/app/.../p/[id]/_thread.test.tsx` — tree derivation correctness; visibility filtering.
- `e2e/comment-thread.spec.ts` — sign in → create post → comment top-level → reply to comment → withdraw a comment → confirm states.

## Notes
- No new deps. Markdown render reuses what B-POST-3 set up (extract a small helper if duplicated).
