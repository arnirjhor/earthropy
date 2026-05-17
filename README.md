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

**v0.0.1 — foundations laid.** Monorepo scaffolded; data model defined; moderation contract defined; i18n scaffolding in place; UI work not started (pending design pass).

See [`CLAUDE.md`](CLAUDE.md) and the approved [v0.1 plan](file:///Users/arnirjhor/.claude-personal/plans/i-have-a-project-merry-glacier.md) for the full roadmap.

## Quick start (after the toolchain is wired up — Phase A)

```bash
pnpm i
pnpm db:up         # Postgres + Redis + MailHog + MinIO via docker compose
pnpm db:migrate
pnpm db:seed       # Seed the 17 SDGs
pnpm dev           # Starts apps/app (3000), apps/web (3001), apps/api (3002), apps/docs (3004)
```

## License

[GNU AGPL-3.0-or-later](LICENSE). Modifications served over a network must publish their source.

## Contributing

We welcome contributors from any country, culture, background, or experience level. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Maintenance and decision rights are documented in [`GOVERNANCE.md`](GOVERNANCE.md).
