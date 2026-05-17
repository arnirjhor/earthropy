---
id: C-WORKER-1
title: "BullMQ worker entry + queue + DLQ"
status: ready
priority: critical
phase: C
agent_model: sonnet
deps: [C-MOD-1]
tags: [moderation, queue, worker, infra]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Stand up the BullMQ worker that drives the moderation pipeline. Producer: post/comment creation enqueues a `moderate-content` job. Consumer: worker resolves `ModerationProvider` from env (Anthropic default), calls `classify()`, applies policy via `decide()`, persists a `moderation_decisions` row, transitions the target's status. Failure handling: retries with exponential backoff (3 attempts), then DLQ.

This task only wires the worker — it does NOT yet wire creation to enqueue (that's C-PIPE-1). The worker should be testable by enqueueing a job from a test fixture.

## Acceptance criteria

- [ ] New package `@repo/queue` OR within `apps/api` — Builder picks; `apps/api/src/workers/` is the natural home for the worker entry, with the queue definition in a shared `packages/queue/`. Prefer the shared package for re-use.
- [ ] `packages/queue/src/index.ts` — exports `moderationQueue` (BullMQ Queue) + `enqueueModeration({ targetType, targetId, locale, context })` producer helper.
- [ ] `apps/api/src/workers/moderation.ts` — Worker entry that:
  - Resolves the provider via env (`MODERATION_PROVIDER`).
  - Calls `provider.classify(input)`.
  - Applies `decide(result, DEFAULT_POLICY, authorReputation)`.
  - Inserts a `moderation_decisions` row (provider, model, scores, verdict, reasoning).
  - Calls the target's `updateStatus` (from `@repo/posts` or `@repo/comments`).
  - Failure → 3 retries with exponential backoff (1s, 5s, 25s).
  - DLQ: a separate `moderation:dead` queue; jobs that exhaust retries land here with full context.
- [ ] `apps/api/package.json` gets a `"worker": "tsx src/workers/index.ts"` script and a top-level `workers/index.ts` entry that starts the moderation worker.
- [ ] Tests: integration tests that enqueue a fake job (replay-fixture provider) and assert the moderation_decisions row + status transition.

## Test plan

- `packages/queue/src/queue.test.ts` — queue init; enqueue helper produces correct job shape.
- `apps/api/src/workers/moderation.test.ts` — integration: enqueue fixture job → worker processes → DB row exists with expected verdict; failing job hits DLQ after retries.

## Notes

- BullMQ requires Redis. Tests use ioredis-mock or a thin local fake (mirror `@repo/ratelimit`'s pattern). Document the choice.
- Add `bullmq` (MIT, allowlist) to `packages/queue` deps.
- The worker process should `process.exit(1)` on uncaught errors so the supervisor (docker-compose / k8s) restarts it.
