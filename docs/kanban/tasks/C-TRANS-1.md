---
id: C-TRANS-1
title: "Public transparency stats page"
status: ready
priority: medium
phase: C
agent_model: sonnet
deps: [C-PIPE-1]
tags: [moderation, transparency, ui]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
The public-facing accountability surface promised in `docs/moderation-policy.md`. A `/transparency` page summarizing the moderation activity: decisions per category, override rate, appeal volume, time-to-resolution. Updated daily (server-cached or queried live; v0.1 can query live since traffic will be low).

## Acceptance criteria

- [ ] Page at `apps/app/src/app/[locale]/(public)/transparency/page.tsx`.
- [ ] Sections:
  - "Last 30 days" — counts of decisions by verdict (auto_publish, hold_for_review, auto_reject, human_publish, human_reject).
  - "By category" — top-3 categories triggering each verdict (mined from `moderation_decisions.scores`).
  - "Appeals" — pending count + resolved count + median time-to-resolution.
  - "Providers" — counts per `moderation_decisions.provider` (Anthropic vs Ollama vs human).
- [ ] All numbers are static text rendered server-side (no charts in v0.1 — just numbers in Plex Mono); a small bar visualization using bg-color divs is optional and cheap.
- [ ] A clear "Read our moderation policy" link at top → `/docs/moderation-policy.md` (the docs site path).
- [ ] AAA contrast; RTL; axe-clean.

## Test plan

- `page.test.tsx` — renders correct numbers with a mocked DB query; empty state ("No decisions in the last 30 days.").
- `e2e/transparency.spec.ts` — visit /transparency → assert at least the section headings render.

## Notes

- Aggregations: use Drizzle SQL functions. Cap the query window at 30 days for v0.1 to keep queries cheap.
- No new top-level deps. No chart library.
