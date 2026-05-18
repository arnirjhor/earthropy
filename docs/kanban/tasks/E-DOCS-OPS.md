---
id: E-DOCS-OPS
title: "Configuration + operations docs"
status: ready
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

- [ ] `docs/configuration.md` lists every environment variable with description and default.
- [ ] `docs/operations.md` covers backup, restore, upgrade, and monitoring.
- [ ] Cross-references `docs/self-host.md`.
