---
id: C-MOD-2
title: "OllamaModerationProvider real impl + tests"
status: done
priority: high
phase: C
agent_model: sonnet
deps: [C-MOD-DESIGN]
tags: [moderation, providers, self-host]
owner: ""
branch: ""
pr: ""
estimated_hours: 3
created: 2026-05-18
updated: 2026-05-18
---

## Description
Implement `OllamaModerationProvider` per `docs/architecture/moderation.md` §3 — the self-hosters' provider. Two-pass design: native Llama Guard 3 prompt for safety axes (uses Llama Guard's own `safe/unsafe\nS-codes` format), plus an aux Llama 3 call with JSON mode for spam/misinfo/off_topic axes. `OLLAMA_AUX_MODEL=none` is a documented degradation path.

## Acceptance criteria

- [ ] Replace stub at `packages/moderation/src/providers/ollama.ts` with real impl.
- [ ] Reads `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama-guard3:8b`), `OLLAMA_AUX_MODEL` (default `llama3.1:8b`, `'none'` to disable aux pass).
- [ ] Two-pass logic:
  - Call Llama Guard with native prompt; parse `safe`/`unsafe + S-codes`; map S-codes to `toxicity / hate / harassment / sexual / self_harm / violence / illegal` axes; unsafe → fixed `0.9` per mapped axis.
  - If `OLLAMA_AUX_MODEL !== 'none'`: call aux model with JSON mode for `spam / misinfo / off_topic`; merge into scores.
  - If aux is disabled, those three axes are absent (read as 0 per `Partial<ModerationScores>` contract).
- [ ] Failure modes mirror Anthropic provider — typed errors (`ProviderUnavailable`, `ProviderTimeout`, etc.).
- [ ] Fixture replay infra: same pattern as Anthropic. `packages/moderation/fixtures/ollama/<scenario>.json` files; tests run with `MODERATION_FIXTURE_REPLAY=1`.

## Test plan
- `packages/moderation/src/providers/ollama.test.ts` — 6 scenarios in replay mode: benign / toxic (S1) / hate (S10) / spam (aux) / off_topic (aux) / refusal (model produces malformed).
- Aux-disabled scenario: `OLLAMA_AUX_MODEL=none` → spam/misinfo/off_topic absent from scores.

## Notes
- No SDK — Ollama exposes a plain HTTP API at `${OLLAMA_BASE_URL}/api/chat`. Use `fetch`; no new deps.
- Fixtures are synthesized (no live Ollama in CI).
- Document the S-code mapping in a comment block.
