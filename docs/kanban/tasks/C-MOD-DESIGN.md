---
id: C-MOD-DESIGN
title: "Architect: Anthropic prompt + scoring scheme; Ollama prompt"
status: done
priority: high
phase: C
agent_model: opus
deps: []
tags: [moderation, architecture]
owner: ""
branch: ""
pr: ""
estimated_hours: 1
created: 2026-05-18
updated: 2026-05-18
---

## Description
Produce the design doc for the AI moderation pipeline at the prompt/scoring level. The provider interface is already in place (`packages/moderation/src/provider.ts`); this doc specifies what we send and how we interpret what comes back, so the two real providers (`C-MOD-1` Anthropic, `C-MOD-2` Ollama) implement against a stable contract.

Output: one markdown design doc — no code beyond illustrative prompts.

## Acceptance criteria

- [ ] `docs/architecture/moderation.md` exists with the following sections:
  - **Mission alignment** — why pre-publication moderation, what AI must NOT decide.
  - **Anthropic Claude prompt** — system + user templates, structured output schema (JSON), temperature, max-tokens, response_format pin, multilingual nuance notes, refusal handling.
  - **Ollama / Llama Guard prompt** — different model class, different prompt shape, mapping back to the same `ModerationCategory` axes.
  - **Score interpretation** — what each category in `[0, 1]` means, calibration notes, what "high" means per axis.
  - **Edge cases** — code blocks, quoted abusive content, satire, language switches mid-text, content under 20 chars, ALL-CAPS, link-stuffing.
  - **Fixture strategy** — how the test suite captures real provider outputs to replay deterministically without burning tokens.
  - **Cost envelope** — back-of-envelope per-post cost for Anthropic default; trigger for self-hoster swap.
  - **Failure modes** — provider unavailable, timeout, rate-limited, malformed JSON; what the worker does in each case.
  - **Logging surface** — what lands in `moderation_decisions` (which already exists in schema); fields and shape.
- Cites existing files by path.

## Test plan
- (N/A — design doc.)

## Notes
The `ModerationProvider`, `ModerationPolicy`, `DEFAULT_POLICY`, and `decide()` already exist in `packages/moderation/src/provider.ts`. Do not re-design them; reference and constrain.
