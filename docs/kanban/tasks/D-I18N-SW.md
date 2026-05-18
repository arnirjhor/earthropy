---
id: D-I18N-SW
title: "Translate messages/sw.json (Swahili)"
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
Translate `apps/app/messages/en.json` to Swahili. Output: `apps/app/messages/sw.json`. Mirror the EXACT key structure of en.json. Preserve all ICU placeholders.

Voice: sober, direct, no marketing.

## Acceptance criteria

- [ ] `apps/app/messages/sw.json` exists with parity to en.json.
- [ ] `apps/web/messages/sw.json` parity with web's en.json.
- [ ] Notifications email-template strings: `sw` entries in `packages/notifications/src/emails/messages/index.ts`.
- [ ] Every `{placeholder}` preserved unchanged.
- [ ] `pnpm typecheck` still green.
