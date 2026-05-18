---
id: E-COMPOSE-PROD
title: "docker-compose.prod.yml + Caddy TLS"
status: done
priority: high
phase: E
agent_model: sonnet
deps: [E-DOCKER-APP, E-DOCKER-API]
tags: [docker, self-host]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
completed: 2026-05-18
---

## Description
Create `docker-compose.prod.yml` that runs the full stack: Postgres, Redis, app, api, and Caddy as reverse proxy with automatic TLS.

## Acceptance criteria

- [x] `docker-compose.prod.yml` defines: postgres, redis, app, api, caddy services.
- [x] Caddy configured for automatic HTTPS with a configurable domain.
- [x] Environment variables documented in `.env.production.example`.
- [x] Health checks on all services.
- [ ] `docker compose -f docker-compose.prod.yml up` works end-to-end. (requires built images; not tested locally per task spec)

## Completion note

Created three files: `docker-compose.prod.yml` (5 services, shared `internal` network, named volumes for postgres/redis/caddy), `deploy/Caddyfile` (ACME TLS, security headers, `/api/*` → api:3002, everything else → app:3000), and `.env.production.example` (all required + optional env vars documented). `pnpm typecheck` passes clean; pre-existing Biome lint errors in playwright config and e2e spec are unchanged.
