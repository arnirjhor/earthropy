# Moderation fixtures

Pre-recorded provider responses used by replay-mode tests (`MODERATION_FIXTURE_REPLAY=1`).

## Anthropic fixtures

Fixtures in `anthropic/` were **synthesized** (not recorded against the live API) because no
`ANTHROPIC_API_KEY` was available at authoring time.  Each `_meta.prompt_sha` matches the
SHA-256 of the system prompt in `src/providers/anthropic-prompt.ts` at the time of authoring.

Re-record against the live API:
```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @repo/moderation record-fixtures
```

Re-record with force (all fixtures, even if prompt_sha matches):
```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @repo/moderation record-fixtures -- --force
```

## Fixture shape

```json
{
  "_meta": {
    "scenario": "benign-post",
    "recorded_at": "2026-05-18T10:00:00Z",
    "recorded_model": "claude-sonnet-4-5",
    "prompt_sha": "<sha256 of system prompt>"
  },
  "input": { "text": "...", "locale": "en", "context": { ... } },
  "raw_response": { "id": "msg_...", "stop_reason": "end_turn", "parsed_output": { ... } },
  "expected_result": { "scores": { ... }, "verdict": "...", "reasoning": "...", "provider": "anthropic", "model": "claude-sonnet-4-5" }
}
```

For the `malformed` scenario, `expected_result` is `null` — the adapter must throw `ProviderMalformed`.

## When to re-record

- The system prompt (`anthropic-prompt.ts`) changes.
- `MODERATION_MODEL` is bumped to a new Claude version.
- A fixture's `prompt_sha` mismatches at test time — the test will fail, forcing re-record.

## CI

CI never records. It runs with `MODERATION_FIXTURE_REPLAY=1` only.
