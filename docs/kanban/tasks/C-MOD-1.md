---
id: C-MOD-1
title: "AnthropicModerationProvider real impl + fixture replay"
status: ready
priority: high
phase: C
agent_model: sonnet
deps: [C-MOD-DESIGN]
tags: [moderation, providers]
owner: ""
branch: ""
pr: ""
estimated_hours: 4
created: 2026-05-18
updated: 2026-05-18
---

## Description
Implement `AnthropicModerationProvider` per the design at `docs/architecture/moderation.md`. The stub in `packages/moderation/src/providers/anthropic.ts` throws; replace with a real impl using `@anthropic-ai/sdk`'s structured-output (`client.messages.parse` + JSON schema). Tests use the fixture-replay strategy from the design doc.

## Acceptance criteria

- [ ] `@anthropic-ai/sdk` added to `@repo/moderation` deps (Apache 2.0, allowlist).
- [ ] Real `classify()` implementation:
  - Reads `ANTHROPIC_API_KEY` from env via a new `packages/moderation/src/env.ts`.
  - Sends the prompt per moderation.md §2 (system + user templates).
  - `temperature: 0`, `model: 'claude-sonnet-4-5'` (configurable via `MODERATION_MODEL` env).
  - Uses `messages.parse` with the JSON schema from the design doc.
  - Maps the response into `ModerationResult` per the adapter contract (scores < 0.05 dropped; `verdict` advisory; `provider: 'anthropic'`; `model` echoed).
  - Failure modes per design doc §8: network error → throw `ProviderUnavailable`; timeout → `ProviderTimeout`; rate-limit (>60s retry-after) → `ProviderRateLimited`; refusal → return result with `verdict: 'hold_for_review'` + reasoning; malformed JSON → `ProviderMalformed`.
- [ ] Fixture infrastructure:
  - `packages/moderation/fixtures/anthropic/` directory.
  - `packages/moderation/scripts/record-fixture.ts` — CLI to record a real response (skipped in CI).
  - Test mode: `MODERATION_FIXTURE_REPLAY=1` flag makes the provider read from fixtures instead of calling the API.
  - Each fixture is JSON: `{ input, raw_response, expected_result, prompt_sha }`.
  - `prompt_sha` is recomputed at runtime; stale → test fails forcing a re-record.
- [ ] Tests use replay (no real API calls in CI):
  - Benign post → published verdict.
  - Toxic post → high toxicity score + auto_reject verdict (post-policy).
  - Spam post → high spam score.
  - Off-topic post → high off_topic score.
  - Refusal scenario → hold_for_review.
  - Malformed response → throws `ProviderMalformed`.
- [ ] `pnpm --filter @repo/moderation test` green with replay mode.

## Test plan
- See acceptance criteria.

## Notes
- Don't call the real Anthropic API in tests. All test fixtures are committed.
- The recording script is for human use when prompts change; CI never records.
- Use the existing `provider.ts` interface + types; don't redesign.
