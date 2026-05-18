---
id: D-I18N-ZH
title: "Translate messages/zh.json (Chinese Simplified)"
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
Translate `apps/app/messages/en.json` to Simplified Chinese. Output: `apps/app/messages/zh.json`. Mirror the EXACT key structure of en.json. Preserve all ICU placeholders (`{name}`, `{count}`, etc.) and selectors.

Voice: sober, direct, no marketing. Match the platform's gravity.

## Acceptance criteria

- [ ] `apps/app/messages/zh.json` exists with parity to en.json — every key present.
- [ ] `apps/web/messages/zh.json` parity with web's en.json.
- [ ] Notifications email-template strings: `zh` entries in `packages/notifications/src/emails/messages/index.ts`.
- [ ] Every `{placeholder}` preserved unchanged.
- [ ] `pnpm typecheck` still green.

## Notes
- Also translate `apps/web/messages/en.json` to `apps/web/messages/zh.json`. Same rules.
