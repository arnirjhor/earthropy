---
id: F-DEPLOY-VERCEL
title: "Deploy hosted instance to Vercel"
status: ready
priority: high
phase: F
agent_model: sonnet
deps: [E-COMPOSE-PROD]
tags: [deploy]
owner: ""
branch: ""
pr: ""
estimated_hours: 2
created: 2026-05-18
updated: 2026-05-18
---

## Description
Configure Vercel deployment for `apps/app` and `apps/web`. Set up environment variables, build settings, and domain configuration.

## Acceptance criteria

- [ ] `vercel.json` or project settings configured for monorepo.
- [ ] Both apps deploy successfully.
- [ ] Environment variables documented.

## Notes
- Requires X-GH-1 (GitHub remote) first.
