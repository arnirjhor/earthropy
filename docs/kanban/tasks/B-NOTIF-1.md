---
id: B-NOTIF-1
title: "Notifications fan-out + in-app UI (SSE)"
status: done
priority: high
phase: B
agent_model: sonnet
deps: [B-POST-1, A-AUTH-1]
tags: [notifications, sse, ui]
owner: ""
branch: ""
pr: ""
estimated_hours: 4
created: 2026-05-18
updated: 2026-05-18
---

## Description
Wire `@repo/notifications`'s `notify()` (currently a throwing stub) to write to the `notifications` table + fan out to in-app SSE listeners. Add a notifications bell in the app shell that shows unread count and a dropdown of recent notifications. Email transport (already wired in A-AUTH-2 for transactional) is the secondary channel triggered by user preferences (in v0.1, only transactional emails fire; this task adds in-app notifications only).

## Acceptance criteria

- [ ] `packages/notifications/src/notify.ts` (replace stub) — inserts a `notifications` row + publishes to an in-process EventEmitter for SSE consumers (in v0.1 a single process; multi-process pub/sub is a v0.2 concern).
- [ ] `apps/app/src/app/api/notifications/stream/route.ts` — Server-Sent Events endpoint. Authenticated; sends "ping" every 25s; sends a JSON event for each new notification for the connected user.
- [ ] `apps/app/src/app/[locale]/(authenticated)/_shell/NotificationsBell.tsx` — client component; opens EventSource on mount; shows unread count badge; dropdown lists recent (last 10).
- [ ] Hooks into the moderation worker (C-WORKER-1) — when a post/comment transitions to `published` or `rejected`, fire `notify({ userId: authorId, kind: 'post_published'|'post_rejected', payload: {...} })`.
- [ ] Hooks into comment creation — `notify({ userId: postAuthorId, kind: 'comment_reply', ... })` on a published comment.
- [ ] Mark-as-read Server Action; mark-all-as-read.
- [ ] AAA contrast; works without JS (the dropdown falls back to a full `/notifications` page).

## Test plan

- `packages/notifications/src/notify.test.ts` — inserts row + emits event.
- `apps/app/src/app/[locale]/(authenticated)/_shell/NotificationsBell.test.tsx` — render with 0 / N unread.
- `e2e/notifications.spec.ts` — sign in → create a post → trigger a "publish" (use the MODERATION_DISABLED=1 fast-path from C-PIPE-1) → assert the bell badge increments and the notification appears in the dropdown.

## Notes

- SSE is the simplest path that gives real-time feel without WebSocket complexity. Multi-process scale-out comes later (Redis pub/sub bridge in v0.2).
- Notifications table is already in schema (`packages/database/src/schema/notifications.ts`).
- No new top-level deps.
