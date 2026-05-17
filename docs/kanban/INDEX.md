# Kanban — v0.1 backlog

**Derived view.** Source of truth lives in `tasks/*.md` — see `_conventions.md`.

Last regenerated: 2026-05-18 (manual; Orchestrator regenerates after each batch).

## Legend

- ⬜ `backlog` · 🟦 `ready` · 🟨 `in_progress` · 🟧 `in_review` · ✅ `done` · ⛔ `blocked` · ⚪ `cancelled`
- Model: O = Opus 4.7 · S = Sonnet 4.6 · H = Haiku 4.5

## Cross-cutting (X)

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `X-VITEST-1` | Vitest config + first cross-package smoke test | ✅ | S | — |
| `X-PLAYWRIGHT-1` | Playwright config + first e2e on apps/web landing | 🟦 | S | — |
| `X-GH-1` | Create GitHub remote + push (**user action required**) | ⛔ | — | — |
| `X-CI-1` | `.github/workflows/ci.yml` (typecheck, lint, test, e2e) | ⛔ | H | `X-GH-1, X-VITEST-1, X-PLAYWRIGHT-1` |

## Phase A — Foundations (remaining)

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `A-SHAD-1` | Init shadcn/ui in @repo/design-system + base components | 🟦 | S | — |
| `A-AUTH-DESIGN` | Architect: @repo/auth design doc | ✅ | O | — |
| `A-AUTH-1` | @repo/auth core: sessions, Argon2id, tokens, CSRF helpers | 🟦 | S | `A-AUTH-DESIGN, X-VITEST-1` |
| `A-AUTH-2` | SMTP via Nodemailer + React Email templates | ⬜ | S | `A-AUTH-1` |
| `A-AUTH-3` | Sign-up / sign-in / verify pages in apps/app | ⬜ | S | `A-AUTH-1, A-AUTH-2, A-SHAD-1` |
| `A-AUTH-4` | Profile + settings pages (locale, notifications) | ⬜ | S | `A-AUTH-3` |
| `A-RATE-1` | Redis-backed rate limiting middleware | ⬜ | S | `A-AUTH-1` |

## Phase B — Community

Stubs land as Phase A nears completion. Backlog from the plan:

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `B-GROUP-1` | Groups CRUD: Server Actions + DB layer + tests | ⬜ | S | `A-AUTH-1` |
| `B-GROUP-2` | Group create form + slug-gen + SDG multi-select | ⬜ | S | `B-GROUP-1, A-SHAD-1` |
| `B-GROUP-3` | Group browse with SDG facet filter | ⬜ | S | `B-GROUP-1` |
| `B-GROUP-4` | Group detail page using AtlasCard patterns | ⬜ | S | `B-GROUP-1` |
| `B-GROUP-5` | Membership: join / leave / invite + role transitions | ⬜ | S | `B-GROUP-1` |
| `B-POST-1` | Posts CRUD + status state machine | ⬜ | S | `B-GROUP-1` |
| `B-POST-2` | Post create form + markdown editor | ⬜ | S | `B-POST-1, A-SHAD-1` |
| `B-POST-3` | Post detail page + moderation-status indicator | ⬜ | S | `B-POST-1` |
| `B-COMMENT-1` | Comments CRUD + threaded model | ⬜ | S | `B-POST-1` |
| `B-COMMENT-2` | Comments thread component | ⬜ | S | `B-COMMENT-1` |
| `B-SDG-1` | `/sdg/[code]` hub: groups + posts faceted | ⬜ | S | `B-GROUP-1, B-POST-1` |
| `B-DASH-1` | Personal dashboard (joined groups + followed SDGs) | ⬜ | S | `B-GROUP-1, B-POST-1` |
| `B-NOTIF-1` | Notifications fan-out + in-app UI (SSE) | ⬜ | S | `B-POST-1, A-AUTH-1` |
| `B-REP-1` | Reputation accrual wiring + history page | ⬜ | S | `B-POST-1, B-COMMENT-1` |

## Phase C — Moderation

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `C-MOD-DESIGN` | Architect: Anthropic prompt + scoring; Ollama prompt | ⬜ | O | — |
| `C-MOD-1` | `AnthropicModerationProvider` real impl + fixtures | ⬜ | S | `C-MOD-DESIGN` |
| `C-MOD-2` | `OllamaModerationProvider` real impl + tests | ⬜ | S | `C-MOD-DESIGN` |
| `C-WORKER-1` | BullMQ worker entry + queue + DLQ | ⬜ | S | `C-MOD-1` |
| `C-PIPE-1` | `pending_ai` → verdict pipeline wired through posts + comments | ⬜ | S | `C-WORKER-1, B-POST-1, B-COMMENT-1` |
| `C-QUEUE-UI-1` | Moderator queue UI | ⬜ | S | `C-PIPE-1` |
| `C-APPEAL-1` | Appeal submission + resolution UI + reputation impact | ⬜ | S | `C-PIPE-1` |
| `C-TRANS-1` | Public transparency stats page | ⬜ | S | `C-PIPE-1` |

## Phase D — Polish & accessibility

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `D-A11Y-1` | axe via Playwright across every public route | ⬜ | S | B+C done |
| `D-KEYBOARD-1` | Keyboard nav audit + fixes | ⬜ | S | B+C done |
| `D-SR-1` | Screen-reader pass (VoiceOver + NVDA) | ⬜ | S | B+C done |
| `D-RTL-1` | Full RTL audit + fixes | ⬜ | S | B+C done |
| `D-LOWBW-1` | No-JS read path; lazy images; image budget | ⬜ | S | B+C done |
| `D-I18N-ES` | Translate `messages/es.json` | ⬜ | H | en.json stable |
| `D-I18N-FR` | Translate `messages/fr.json` | ⬜ | H | en.json stable |
| `D-I18N-AR` | Translate `messages/ar.json` (RTL review) | ⬜ | H | en.json stable |
| `D-I18N-ZH` | Translate `messages/zh.json` | ⬜ | H | en.json stable |
| `D-I18N-HI` | Translate `messages/hi.json` | ⬜ | H | en.json stable |
| `D-I18N-PT` | Translate `messages/pt.json` | ⬜ | H | en.json stable |
| `D-I18N-RU` | Translate `messages/ru.json` | ⬜ | H | en.json stable |
| `D-I18N-SW` | Translate `messages/sw.json` | ⬜ | H | en.json stable |

## Phase E — Self-host

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `E-LICENSE-FULL` | Bundle full AGPLv3 text into `LICENSE` | ⬜ | H | — |
| `E-DOCKER-APP` | `apps/app/Dockerfile` (Next standalone) | ⬜ | S | A–D done |
| `E-DOCKER-API` | `apps/api/Dockerfile` | ⬜ | S | A–D done |
| `E-COMPOSE-PROD` | `docker-compose.prod.yml` + Caddy for TLS | ⬜ | S | `E-DOCKER-APP, E-DOCKER-API` |
| `E-DOCS-OPS` | `docs/configuration.md`, `docs/operations.md` | ⬜ | H | `E-COMPOSE-PROD` |

## Phase F — Ship v0.1

| ID | Title | Status | Model | Deps |
|---|---|---|---|---|
| `F-DEPLOY-VERCEL` | Deploy hosted instance to Vercel; DNS | ⬜ | S | E done |
| `F-SEED-17` | Seed 17 official-tagged groups, one per SDG | ⬜ | S | `F-DEPLOY-VERCEL` |
| `F-LAUNCH` | Launch post; open contributor backlog | ⬜ | H | `F-SEED-17` |

## Tallies

- Total: 50 tasks
- Ready now: 4 (`X-VITEST-1`, `X-PLAYWRIGHT-1`, `A-SHAD-1`, `A-AUTH-DESIGN`)
- Blocked: 1 (`X-GH-1` — user action) + `X-CI-1` (chains on X-GH-1)
- Backlog (waiting on deps): 45
- In progress: 0
- Done: 0

## Active dispatch

(Updated by the Orchestrator per wake cycle.)

- (none — wave 1 dispatch imminent)
