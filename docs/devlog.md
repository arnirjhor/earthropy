# Earthropy Development Log

> Living document. Updated after every wave/commit. Newest entries at the top.

---

## v0.2 — 2026-05-20

**7 features shipped in a single parallel wave.** 96 files, 10,609 lines added.

### Wave 19 — v0.2 full parallel dispatch
`14a4f62` + `2aa76f4` | 2026-05-20

| Feature | Packages | Summary |
|---------|----------|---------|
| GitHub Actions CI | — | 3-job pipeline: lint/typecheck, test (Postgres service container), Docker build smoke. Concurrency groups, Turbo + pnpm caching. |
| Plugin SDK + MCP | `plugin-sdk`, `mcp-server` | 7 typed hooks (beforeModeration, afterModeration, beforePublish, afterPublish, onReputationChange, onGroupJoin, onNotification). PluginRegistry with lifecycle. MCP server exposes 5 tools. Webhook example plugin. |
| AI Community Manager | `community-agent` | Anthropic + Ollama providers. Stale discussion detection, member group suggestions, weekly digest drafts. BullMQ worker with daily/weekly cron. Fully opt-in. |
| LLM Translation | `translation` | LibreTranslate (self-host default) + DeepL (managed opt-in). Postgres cache layer. Translate toggle UI on posts + comments. Rate-limited server action. |
| 5 New Locales | — | ja, id, ko, tr, bn. App + web + email templates. Total: 14 locales. |
| Federation Spike | — | `docs/federation-design.md`. Schema impact, identity model, protocol complexity. Recommends Level 1 (read-only outbound) for v0.3. |
| Outcome Tracking | — | 34 curated SDG indicators. `sdg_indicators` + `outcomes` + `outcome_posts` tables. Report form on group detail. Progress + impact views. Idempotent seed script. |

**Post-wave fix:** Removed MCP server `dev` script that crashed `turbo dev` (stdio process, not a dev server).

---

## v0.1 — 2026-05-18

**52 tasks across 6 phases. 18 waves of autonomous agent orchestration.** From empty repo to shippable platform.

### Wave 17–18 — Phase E/F completion + ship
`831c8a3` | 2026-05-18

| Task | Summary |
|------|---------|
| E-DOCS-OPS | `docs/configuration.md` (all env vars, service mapping) + `docs/operations.md` (setup, backup, upgrade, monitoring, troubleshooting) |
| F-SEED-17 | `seed-groups.ts` — idempotent script creating 17 official SDG groups + system user. `pnpm db:seed-groups` |
| X-GH-1 | GitHub repo created at github.com/arnirjhor/earthropy (public, AGPLv3) |
| F-DEPLOY-VERCEL | `apps/app/vercel.json` + `docs/deploy-vercel.md` |
| F-LAUNCH | README + CONTRIBUTING updated. `docs/v02-backlog.md` created. |

### Wave 16 — Phase D accessibility (batch 2)
`831c8a3` | 2026-05-18

| Task | Summary |
|------|---------|
| D-A11Y-1 | axe audit — 3 violations fixed: aria-label on signin tablist, labeled comment articles, disambiguated session revoke buttons |
| D-RTL-1 | 7 physical→logical CSS property fixes across 4 files (`ml-`→`ms-`, `text-left`→`text-start`, `right-4`→`end-4`) |
| D-LOWBW-1 | `<noscript>` fallbacks for SdgFilter + VisibilityFilter. Image optimization config (AVIF/WebP). `docs/image-budget.md` |

### Wave 15 — Phase D/E kickoff
`831c8a3` | 2026-05-18

| Task | Summary |
|------|---------|
| E-COMPOSE-PROD | `docker-compose.prod.yml` (postgres, redis, app, api, caddy). Health checks, fail-fast secrets. `deploy/Caddyfile` with security headers + auto-TLS. `.env.production.example` |
| D-KEYBOARD-1 | 15 files: skip-to-content link, `focus:`→`focus-visible:` fixes, missing focus rings, Escape key on notification dropdown, semantic `<output>` elements |
| D-SR-1 | 10+ files: ARIA landmarks + labels, `aria-live` on notifications, tab widget on post editor, table a11y, `docs/a11y-voiceover-script.md` |

### Waves 13–14 — Phase D i18n (batch 2–3)
`93a11b1` | 2026-05-18

| Task | Summary |
|------|---------|
| E-LICENSE-FULL | Full AGPLv3 license text bundled |
| E-DOCKER-APP | `apps/app/Dockerfile` — Next.js standalone |
| E-DOCKER-API | `apps/api/Dockerfile` — Next.js standalone |
| D-I18N-PT | Portuguese translations |
| D-I18N-RU | Russian translations |
| D-I18N-SW | Swahili translations |

### Waves 11–12 — Phase D i18n (batch 1)
`9991ac2` | 2026-05-18

| Task | Summary |
|------|---------|
| D-I18N-AR | Arabic translations (RTL) |
| D-I18N-ZH | Chinese translations |
| D-I18N-HI | Hindi translations |
| D-I18N-ES | Spanish translations |
| D-I18N-FR | French translations |

### Wave 10 — Phase B/C final
`33b2e69`..`d865c43` | 2026-05-18

| Task | Summary |
|------|---------|
| C-TRANS-1 | `/transparency` public moderation stats page |
| B-SDG-1 | `/sdg/[code]` hub — groups + posts + follow toggle |
| C-APPEAL-1 | Appeal submission + resolution UI + reputation impact |

### Wave 9 — Community + moderation
`fe6fb7c`..`e9c7343` | 2026-05-18

| Task | Summary |
|------|---------|
| C-QUEUE-UI-1 | Moderator queue page + publish/reject actions |
| B-REP-1 | Reputation accrual wiring + history page |
| B-GROUP-5 | Membership invite/claim/role/transfer + UI |

### Wave 8 — Dashboard + pipeline + notifications
`7df4cc0`..`97b4350` | 2026-05-18

| Task | Summary |
|------|---------|
| B-DASH-1 | Personal dashboard — joined groups + followed SDGs feed |
| C-PIPE-1 | `pending_ai` → verdict pipeline wired through posts + comments |
| B-NOTIF-1 | SSE notifications + NotificationsBell component |

### Wave 7 — Threads + groups + workers
`513a8d0`..`82fa105` | 2026-05-18

| Task | Summary |
|------|---------|
| B-COMMENT-2 | Threaded comment UI + ReplyForm + Withdraw |
| B-GROUP-4 | `/g/[slug]` detail page with AtlasCard header |
| C-WORKER-1 | @repo/queue + BullMQ moderation worker + DLQ |

### Wave 6 — Moderation providers + browse
`2453775`..`c9bbccc` | 2026-05-18

| Task | Summary |
|------|---------|
| C-MOD-2 | OllamaModerationProvider — two-pass guard + aux |
| B-POST-3 | Post detail page + moderation banner + withdraw |
| B-GROUP-3 | `/g` browse with SDG facet filter |

### Wave 5 — Posts + comments + Anthropic
`4bc9a14`..`ae70c91` | 2026-05-18

| Task | Summary |
|------|---------|
| B-COMMENT-1 | @repo/comments package + Server Actions |
| B-POST-2 | Post create form with markdown preview |
| C-MOD-1 | AnthropicModerationProvider + fixture replay |

### Wave 4 — Posts + account + group form
`8027a48`..`1d7639a` | 2026-05-18

| Task | Summary |
|------|---------|
| B-POST-1 | @repo/posts CRUD + status state machine |
| A-AUTH-4 | Account page — profile, sessions, locale, deletion |
| B-GROUP-2 | `/g/new` form + SdgMultiSelect component |

### Wave 3 — Auth pages + groups + moderation design
`474244b`..`fef26ee` | 2026-05-18

| Task | Summary |
|------|---------|
| A-AUTH-2 | SMTP transport + verify/magic-link/reset email templates |
| C-MOD-DESIGN | Moderation pipeline architecture doc |
| B-GROUP-1 | @repo/groups CRUD + slug gen + Server Actions |
| A-AUTH-3 | Signup/signin/verify/reset pages + auth gate |

### Wave 2 — Design system + auth core + rate limit
`c978bbb`..`97e52b0` | 2026-05-18

| Task | Summary |
|------|---------|
| A-SHAD-1 | shadcn base components on Field Record design tokens |
| A-AUTH-1 | @repo/auth core — sessions, Argon2id, tokens, CSRF |
| A-RATE-1 | Redis-backed rate limiting middleware |

### Wave 1 — Foundation
`a17809f`..`0aa0d82` | 2026-05-18

| Task | Summary |
|------|---------|
| — | Monorepo scaffold (Turborepo, pnpm, 10 packages, 4 apps) |
| — | Field Record visual identity design pass |
| X-VITEST-1 | Vitest workspace config + SDG smoke tests |
| X-PLAYWRIGHT-1 | Playwright + axe e2e harness |
| A-AUTH-DESIGN | Auth subsystem architecture doc |

---

## Stats

| Metric | Value |
|--------|-------|
| Total commits | 60 |
| Workspace packages | 22 |
| Locales | 14 (en, es, fr, ar, zh, hi, pt, ru, sw, ja, id, ko, tr, bn) |
| Tests | 500+ |
| v0.1 tasks | 52/52 |
| v0.2 features | 7/7 |
| License | AGPL-3.0-or-later |
| Repo | github.com/arnirjhor/earthropy |
