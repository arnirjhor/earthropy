---
id: E-DOCKER-API
title: "apps/api Dockerfile"
status: done
priority: high
phase: E
agent_model: sonnet
deps: []
tags: [docker, self-host]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Create a Dockerfile for `apps/api` (the BullMQ worker + API server). Must work with pnpm workspace.

## Acceptance criteria

- [ ] `apps/api/Dockerfile` exists and builds successfully.
- [ ] Uses multi-stage build.
- [ ] Runtime image is `node:22-alpine`.
- [ ] `docker build -f apps/api/Dockerfile .` succeeds from repo root.
