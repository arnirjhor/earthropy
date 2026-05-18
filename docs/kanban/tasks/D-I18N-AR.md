---
id: D-I18N-AR
title: "Translate messages/ar.json (Arabic)"
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
Translate `apps/app/messages/en.json` to Arabic. Output: `apps/app/messages/ar.json`. Mirror the EXACT key structure of en.json. Preserve all ICU placeholders (`{name}`, `{count}`, etc.) and selectors. Arabic is RTL — the UI handles direction via dir="rtl"; translation strings themselves should be natural Arabic.

Voice: sober, direct, no marketing. Match the platform's gravity.

## Acceptance criteria

- [ ] `apps/app/messages/ar.json` exists with parity to en.json — every key present.
- [ ] `apps/web/messages/ar.json` parity with web's en.json.
- [ ] Every `{placeholder}` preserved unchanged.
- [ ] `pnpm typecheck` still green.

## Notes
- Also translate `apps/web/messages/en.json` to `apps/web/messages/ar.json`. Same rules.
- Notifications email-template strings for Arabic already exist in `packages/notifications/src/emails/messages/index.ts`.
