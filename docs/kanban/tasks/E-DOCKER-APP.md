---
id: E-DOCKER-APP
title: "apps/app Dockerfile (Next.js standalone)"
status: ready
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
Create a multi-stage Dockerfile for `apps/app` using Next.js standalone output. Must work with the monorepo structure (pnpm workspace + Turborepo pruning).

## Acceptance criteria

- [ ] `apps/app/Dockerfile` exists and builds successfully.
- [ ] Uses multi-stage build (deps → build → runtime).
- [ ] Runtime image is based on `node:22-alpine`.
- [ ] `next.config.ts` has `output: 'standalone'`.
- [ ] Image runs on port 3000 by default (env-configurable).
- [ ] `docker build -f apps/app/Dockerfile .` succeeds from repo root.
