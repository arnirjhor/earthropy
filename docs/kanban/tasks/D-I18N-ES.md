---
id: D-I18N-ES
title: "Translate messages/es.json (Spanish)"
status: done
priority: medium
phase: D
agent_model: haiku
deps: []
tags: [i18n, translation]
owner: ""
branch: ""
pr: ""
estimated_hours: 1
created: 2026-05-18
updated: 2026-05-18
---

## Description
Translate `apps/app/messages/en.json` to Spanish. Output: `apps/app/messages/es.json`. Mirror the EXACT key structure of en.json. Preserve all ICU placeholders (`{name}`, `{count}`, etc.) and selectors.

Voice: sober, direct, no marketing. Match the platform's gravity. Don't soften "rejected" into "let's revisit" — the moderation flow needs honest words.

## Acceptance criteria

- [ ] `apps/app/messages/es.json` exists with parity to en.json — every key present.
- [ ] Every `{placeholder}` preserved unchanged.
- [ ] `pnpm typecheck` still green (next-intl checks key parity at type level).

## Test plan
- (N/A — translation only)

## Notes
- Translate `apps/web/messages/en.json` to `apps/web/messages/es.json` too. Same rules.
- Also: `packages/notifications/src/emails/messages/index.ts` has email-template strings; add `es` entries there too.
