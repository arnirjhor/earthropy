---
id: E-COMPOSE-PROD
title: "docker-compose.prod.yml + Caddy TLS"
status: ready
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
---

## Description
Create `docker-compose.prod.yml` that runs the full stack: Postgres, Redis, app, api, and Caddy as reverse proxy with automatic TLS.

## Acceptance criteria

- [ ] `docker-compose.prod.yml` defines: postgres, redis, app, api, caddy services.
- [ ] Caddy configured for automatic HTTPS with a configurable domain.
- [ ] Environment variables documented in `.env.example`.
- [ ] Health checks on all services.
- [ ] `docker compose -f docker-compose.prod.yml up` works end-to-end.
