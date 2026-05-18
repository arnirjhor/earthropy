# Earthropy

> Earth + Entropy = Earthropy. Action against the planet's growing disorder.

Earthropy is a managed open-source platform for coordinating global action on the **17 [UN Sustainable Development Goals](https://sdgs.un.org/goals)**. A neutral, forever-free, corporation-agnostic place where local communities, NGOs, researchers, and individuals can organize projects, communicate, and collaborate — with AI handling the unglamorous heavy lifting (content moderation, surfacing relevant work) so humans focus on the mission.

## Principles

- **Forever free.** No paywalls, no premium tier, no extraction.
- **Corp-agnostic.** Every external dependency is pluggable. Self-hosters can swap any paid service for an open one.
- **Universally accessible.** Multi-language, screen-reader friendly, low-bandwidth, no identity disclosure required.
- **AI does scut work, humans do mission work.** AI pre-moderates content for safety; AI does not decide policy.
- **Transparent moderation.** Every AI decision is logged, reasoned, and appealable. See [`docs/moderation-policy.md`](docs/moderation-policy.md).
- **17 SDGs as the taxonomy.** The full UN goals are the categorical structure of the platform.

## Status

**v0.1 — available now.**

- Accounts: email + password, magic links, rate limiting
- Community: groups, posts, comments, SDG-tagged content
- AI moderation: Anthropic Claude (default) + Ollama (self-host fallback), transparent decisions, appeals
- i18n: 9 locales — Arabic, Chinese, English, French, German, Hindi, Portuguese, Russian, Swahili — with RTL support
- Accessibility: keyboard navigation, screen reader support, axe audit, RTL audit, WCAG AA contrast
- Self-host: Docker + Caddy, documented from zero to running
- Vercel deployment config for managed hosting
- 500+ tests

## Quick start (dev)

```bash
git clone https://github.com/arnirjhor/earthropy
cd earthropy
nvm use           # Node 22 via .nvmrc
corepack enable   # pnpm via Corepack
pnpm i
pnpm db:up        # Postgres + Redis + MailHog + MinIO via docker compose
pnpm db:migrate
pnpm db:seed      # Seed the 17 SDGs
pnpm dev          # app:3000  web:3001  api:3002  docs:3004
```

## Self-host

See [`docs/self-host.md`](docs/self-host.md) and [`docs/operations.md`](docs/operations.md) for a complete self-host guide (Docker Compose, Caddy reverse proxy, env vars, backup).

## Deploy to Vercel

See [`docs/deploy-vercel.md`](docs/deploy-vercel.md).

## Configuration reference

See [`docs/configuration.md`](docs/configuration.md).

## Contributing

We welcome contributors from any country, culture, background, or experience level. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Maintenance and decision rights are documented in [`GOVERNANCE.md`](GOVERNANCE.md).

## License

[GNU AGPL-3.0-or-later](LICENSE). Modifications served over a network must publish their source.
