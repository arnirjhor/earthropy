# Getting Started

Earthropy is in **v0.0.1 — foundations laid**. The full v0.1 ships in roughly 6–10 weeks of focused work; see the project plan for the phase breakdown. Until then, this guide is for contributors and early operators.

## For contributors

See [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## For self-hosters

See [`docs/self-host.md`](self-host.md).

## For end users

The hosted instance at `earthropy.org` is not live yet. Subscribe to releases on the repository to be notified when v0.1 ships.

## What works today

- Monorepo scaffolded with apps + packages.
- 17 SDG canonical metadata in `@repo/sdg`.
- Full Drizzle DB schema in `@repo/database` (users, groups, posts, comments, moderation_decisions, appeals, reputation_events, notifications, SDG seed).
- Moderation provider contract in `@repo/moderation`.
- i18n routing config in `@repo/i18n` (9 locales, RTL ready).
- Reputation tier helpers in `@repo/trust`.
- Local infrastructure via `docker-compose.yml` (Postgres + Redis + MailHog + MinIO).

## What does not yet work

- Authentication (Phase A step 2).
- Database migrations need to be generated from the schema (`pnpm --filter @repo/database generate`).
- UI of any kind (pending design pass).
- Moderation providers (Anthropic, Ollama) are stubs that throw.
- Notifications are stubs that throw.

## Roadmap

Phase A: foundations  → Phase B: community  → Phase C: moderation  → Phase D: polish & a11y  → Phase E: self-host story  → Phase F: ship v0.1 at `earthropy.org`.
