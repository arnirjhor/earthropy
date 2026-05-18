---
id: D-I18N-FR
title: "Translate messages/fr.json (French)"
status: ready
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
Translate `apps/app/messages/en.json` to French. Same rules as D-I18N-ES (key parity, placeholder preservation, sober voice).

## Acceptance criteria

- [ ] `apps/app/messages/fr.json` parity with en.json.
- [ ] `apps/web/messages/fr.json` parity with web's en.json.
- [ ] Notifications email-template strings: `fr` entries in `packages/notifications/src/emails/messages/index.ts`.
- [ ] All ICU placeholders preserved.
- [ ] `pnpm typecheck` green.

## Notes
- French uses curly quotes (« »); use them.
