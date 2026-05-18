---
id: D-I18N-PT
title: "Translate messages/pt.json (Portuguese)"
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
Translate `apps/app/messages/en.json` to Portuguese (Brazilian). Output: `apps/app/messages/pt.json`. Mirror the EXACT key structure of en.json. Preserve all ICU placeholders.

Voice: sober, direct, no marketing.

## Acceptance criteria

- [ ] `apps/app/messages/pt.json` exists with parity to en.json.
- [ ] `apps/web/messages/pt.json` parity with web's en.json.
- [ ] Notifications email-template strings: `pt` entries in `packages/notifications/src/emails/messages/index.ts`.
- [ ] Every `{placeholder}` preserved unchanged.
- [ ] `pnpm typecheck` still green.
