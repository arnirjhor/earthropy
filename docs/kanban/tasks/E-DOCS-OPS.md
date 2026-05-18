---
id: E-DOCS-OPS
title: "Configuration + operations docs"
status: done
priority: medium
phase: E
agent_model: haiku
deps: [E-COMPOSE-PROD]
tags: [docs, self-host]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Write `docs/configuration.md` (all env vars, their defaults, what they control) and `docs/operations.md` (backup/restore, upgrade procedure, log access).

## Acceptance criteria

- [x] `docs/configuration.md` lists every environment variable with description and default.
- [x] `docs/operations.md` covers backup, restore, upgrade, and monitoring.
- [x] Cross-references `docs/self-host.md`.

## Completion note

Created `docs/configuration.md` (all env vars grouped by feature, service-to-variable mapping table, how variables flow through Compose) and `docs/operations.md` (first-time setup, backup/restore, upgrade with rollback strategy, monitoring, troubleshooting). Both cross-reference `docs/self-host.md`. No source changes — typecheck and lint unaffected.
