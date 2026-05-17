# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Earthropy is a forever-free, corp-agnostic platform for coordinating global action on the **17 UN Sustainable Development Goals (SDGs)**. The mission, full architecture, and approved v0.1 plan live in `/Users/arnirjhor/.claude-personal/plans/i-have-a-project-merry-glacier.md` — read it before touching architecture. User-facing intro in `README.md`. Governance in `GOVERNANCE.md`. Moderation transparency promise in `docs/moderation-policy.md`.

## Layout (Turborepo monorepo)

```
apps/
  app/   # Authenticated SaaS app (port 3000) — Next.js 16 + next-intl [locale] segment
  web/   # Marketing site (port 3001)        — Next.js 16 + next-intl
  api/   # REST + BullMQ workers (port 3002) — Next.js 16
  docs/  # Public docs (port 3004)            — Next.js 16
packages/
  sdg/             # 17 SDGs canonical metadata. Mission-defining; coordinate any edits.
  database/        # Drizzle ORM + Postgres schema + migrations + seed
  auth/            # Email + password & magic link (Phase A stub for now)
  moderation/      # ModerationProvider interface + Anthropic/Ollama implementations
  trust/           # Reputation tiers + capability checks
  i18n/            # next-intl routing, locale list, RTL helper
  design-system/   # Tailwind tokens, shadcn primitives (UI lands after design pass)
  notifications/   # In-app + SMTP fan-out (Phase B stub)
  observability/   # Structured logger + OTel (Phase D)
```

Imports across the workspace use `@repo/<name>`. App-internal imports use `@/...`.

## Commands

```bash
pnpm i                 # Install workspace deps
pnpm db:up             # Bring up Postgres, Redis, MailHog, MinIO via docker compose
pnpm db:migrate        # Apply Drizzle migrations
pnpm db:seed           # Seed the 17 SDGs row
pnpm dev               # Start all apps (turbo runs each app's `next dev`)
pnpm --filter @earthropy/app dev   # Start just the main app
pnpm typecheck         # `tsc --noEmit` across the workspace
pnpm lint              # Biome (formatter + linter unified)
pnpm lint:fix          # Biome with --write
pnpm test              # Vitest (added when first tests land)
pnpm --filter @repo/database generate  # Drizzle migration from schema diff
```

Per-app ports: `app:3000`, `web:3001`, `api:3002`, `docs:3004`, `drizzle-studio:3005`, MailHog UI: `localhost:8025`, MinIO console: `localhost:9001`.

## Architectural rules (load-bearing)

1. **Corp-agnostic.** Every external dependency lives behind an interface so a self-hoster can swap it. The default provider may be a paid service (Anthropic, Resend) but a self-hostable fallback (Ollama, SMTP) must exist. See `packages/moderation/src/provider.ts` for the canonical pattern.
2. **AGPLv3.** All code is AGPL-3.0-or-later. Any introduced dep must be license-compatible (MIT, BSD, Apache-2.0, MPL, AGPL). No proprietary or non-commercial-only deps.
3. **Moderation transparency.** `moderation_decisions` rows are immutable. Never `UPDATE`/`DELETE` them; create a follow-up decision row to override.
4. **No corporate identity required.** Auth is email + reputation. Do not add OAuth-with-corp-provider as the primary path. (Optional social login may come later.)
5. **Accessibility is not optional.** RTL via `dir="rtl"` from day one (`packages/i18n/src/locales.ts` declares the list). All interactive elements get keyboard support. Color contrast WCAG AA minimum; AAA where it doesn't break the design.
6. **17 SDGs are the taxonomy.** Do not add categories outside `packages/sdg/src/sdgs.ts`. The list is fixed by the UN; if it ever updates, that's a single coordinated change.

## Frontend work — Plan Mode first

Before writing any UI code:

- Propose 2–3 distinct aesthetic directions (reference products + typography pair + color system + motion treatment).
- No Inter / Roboto / Arial / system-ui defaults. No purple-on-white gradients. No glassmorphism unless declared.
- Log every accepted/rejected direction in `docs/design-patterns.md` so future sessions see the reasoning.
- The user verifies UI changes themselves; do not run chrome-devtools-mcp or playwright screenshot passes, and skip `/web-interface-guidelines` audits.

## Library docs

Use `context7` (`mcp__plugin_context7_context7__query-docs`) for Next.js, next-intl, Drizzle, shadcn, Tailwind, React syntax. Prefer it over web search.

## What's in v0.1 vs. deferred

**In v0.1:** Accounts, groups, posts, comments, AI pre-publication moderation, reputation, i18n scaffolding, basic dashboard, docs, self-host story.

**Deferred (do not implement opportunistically):**
- Plugin SDK / MCP integrations → v0.2
- AI community-manager agent → v0.2
- LLM-translated post bodies → v0.2
- Federation (ActivityPub) → v2
- Verifiable outcome tracking against UN SDG indicators → v0.3+
- Funding/payment integration → v0.3+

If the user asks for a deferred thing, build it. Otherwise stay in scope.

## Coding conventions

- TypeScript strict, `noUncheckedIndexedAccess` on, `verbatimModuleSyntax` on.
- Imports use the `.ts` extension where required by `verbatimModuleSyntax` + ESM resolution.
- Biome is the single source of formatting + linting. Don't add ESLint or Prettier.
- ORM: Drizzle. Don't introduce Prisma.
- DB driver: `postgres` (postgres-js).
- Migrations: `pnpm --filter @repo/database generate` to produce SQL from schema diff; commit the diff.
- Server Components by default; reach for `'use client'` only when an interaction needs it.
- No `console.log`. Use `@repo/observability` `log`.
- Don't add error handling for impossible cases. Validate at boundaries (HTTP, DB return, env). Trust internal calls.

## How verification is done

This project has no UI test infra yet (lands Phase D). For now:
- `pnpm typecheck` — must pass before claiming done.
- `pnpm lint` — must pass before commit.
- For DB schema changes: regenerate migration, run `pnpm db:migrate` against a fresh Postgres, then run `pnpm db:seed`.
- For new packages: ensure they appear in apps' `transpilePackages` list in `next.config.ts` if consumed there.

## Where to look for context, in order

1. `README.md` — project mission, framing.
2. `/Users/arnirjhor/.claude-personal/plans/i-have-a-project-merry-glacier.md` — full v0.1 plan with phases and verification.
3. `docs/moderation-policy.md` — the transparency promise that shapes the moderation pipeline.
4. `GOVERNANCE.md` — managed-open-source model, who decides what.
5. `docs/design-patterns.md` — accepted and rejected design directions.
6. `CONTRIBUTING.md` — workflow for outside contributors.
