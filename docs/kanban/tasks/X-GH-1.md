---
id: X-GH-1
title: "Create GitHub remote + push (user action required)"
status: blocked
priority: critical
phase: X
agent_model: opus
deps: []
tags: [tooling, governance, foundation]
owner: "user"
branch: ""
pr: ""
estimated_hours: 0
created: 2026-05-18
updated: 2026-05-18
---

## Description
Cannot run a PR-based workflow without a remote. The user needs to create the GitHub repository (the project's long-term home), set the local repo's remote to it, and push `main`.

## Acceptance criteria
- [ ] GitHub organization/repo exists (suggest: `earthropy/earthropy` or `<user>/earthropy`).
- [ ] `git remote -v` shows `origin` pointing at the new repo.
- [ ] `main` is pushed (`git push -u origin main`).
- [ ] Repo settings: private OR public — user's call (public aligns with the AGPL ethos).
- [ ] Branch protection on `main`: require PR + passing checks (configurable later once CI lands).

## Test plan
- `git remote -v` exists and matches.
- `git ls-remote origin main` returns a SHA equal to local `git rev-parse main`.

## Notes
**Escalation required.** Orchestrator cannot create remote repos. Tell the user once and continue local-only branch workflow ("PR" = open branch) until this resolves.
