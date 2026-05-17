---
id: C-PIPE-1
title: "pending_ai → verdict pipeline wired through posts + comments"
status: ready
priority: critical
phase: C
agent_model: sonnet
deps: [C-WORKER-1, B-POST-1, B-COMMENT-1]
tags: [moderation, pipeline, integration]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Connect post + comment creation to the BullMQ moderation worker. Currently `createPost` / `createComment` insert with status `pending_ai` and stop; the worker exists but no one enqueues. This task closes the loop: every newly-created post or comment immediately enqueues a `moderate-content` job; the worker processes; status transitions to `published`/`pending_review`/`rejected`. Author and group moderators see the verdict reflected on next page load.

## Acceptance criteria

- [ ] `packages/posts/src/createPost.ts` calls `enqueueModeration` from `@repo/queue` after the INSERT commits successfully. Same for `packages/comments/src/createComment.ts`.
- [ ] The enqueue includes `{ targetType: 'post'|'comment', targetId, locale, context: { groupSdgCodes, authorReputation, targetType } }` — `groupSdgCodes` resolved from the group's SDGs, `authorReputation` from `users.reputation`.
- [ ] Hook into `packages/posts/src/events.ts` and `packages/comments/src/events.ts` (existing stubs) so the enqueue happens through `onStatusChange` when status transitions out of `pending_ai`. Wait — re-read those: the events module is for OBSERVING status changes; the ENQUEUE should happen right at insert time before the worker even sees it. So: enqueue at the end of `createPost` / `createComment` directly, not via events.
- [ ] After the worker updates status (in `apps/api/src/workers/moderation.ts`'s `processModerationJob`), it should ALSO fire the events module's `onStatusChange` (already wired in worker code per C-WORKER-1 review). Notifications (B-NOTIF-1) and reputation (B-REP-1) will subscribe.
- [ ] If REDIS_URL is unset or `MODERATION_DISABLED=1`, enqueue is a no-op AND the row's status is bumped to `published` immediately (dev convenience flag; documented in `docs/architecture/moderation.md`).
- [ ] Integration tests: enqueue a real BullMQ job using ioredis-mock (or the manual fake) → confirm status transitions through the pipeline. (Re-use the worker test infrastructure from C-WORKER-1.)

## Test plan

- `packages/posts/src/createPost.test.ts` — extend: a successful create produces an enqueue side-effect (mock the queue).
- `packages/comments/src/createComment.test.ts` — same.
- `apps/api/src/workers/moderation.test.ts` — extend: full round-trip from createPost → worker → published status.

## Notes

- Don't mock through `@repo/queue` in production code — keep it a direct dependency. The test fake is opt-in via env (`QUEUE_TESTING_FAKE=1` or similar).
- The MODERATION_DISABLED dev path is for getting through e2e + screenshot sessions without needing the worker running.
- This task does NOT add UI for "your post is being reviewed" — that's already in B-POST-3's status banner. This task only connects the wires.
