# Self-Hosting Earthropy

Earthropy is designed to be self-hostable. The hosted `earthropy.org` instance is one valid deployment; an NGO running its own instance for a regional SDG initiative is another. This document is the operator's guide.

> Self-hosting is **fully supported** in v0.1, but the full deploy story (production-grade Dockerfiles for `apps/app` and `apps/api`) lands in Phase E. Until then, follow the dev setup.

## Requirements

- Docker + Docker Compose, or equivalent (Postgres 16 + Redis 7 + S3-compatible storage + SMTP relay).
- Node 22 LTS and pnpm 9+ for building.
- A domain name and TLS certificate (Let's Encrypt is fine).
- Optional: an Anthropic API key (the default moderation provider). Alternatively, a running Ollama server with a guard model (e.g. `llama-guard3:8b`).

## Quick start (dev / staging)

```bash
git clone https://github.com/<org>/earthropy
cd earthropy
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET and (if using Anthropic) ANTHROPIC_API_KEY.
nvm use
corepack enable
pnpm i
pnpm db:up         # Starts Postgres, Redis, MailHog, MinIO
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Visit `http://localhost:3000`.

## Production deployment

Production-grade Dockerfiles, Helm charts, and one-click Vercel templates land in Phase E (week 8–9 of the v0.1 plan). Until then, treat self-hosting as advanced — happy to support early adopters on the issue tracker.

## Configuration

All configuration is via env vars; see [`.env.example`](../.env.example) for the complete list.

Key knobs:

| Var | Purpose |
|---|---|
| `MODERATION_PROVIDER` | `anthropic` (default) or `ollama` |
| `ANTHROPIC_API_KEY` | Required if provider=anthropic |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Required if provider=ollama |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (queues, rate limits) |
| `AUTH_SECRET` | 32+ random bytes — sign session cookies |
| `SMTP_*` | Email transport (verification + notifications) |
| `S3_*` | Object storage (uploads — Phase B) |

## Operator responsibilities

If you run an Earthropy instance:

1. **Moderation policy applies.** [`docs/moderation-policy.md`](moderation-policy.md) is the floor; you can be stricter, you cannot be more permissive in ways that conflict with the CoC.
2. **Backups.** Postgres + S3 are your responsibility. The platform expects to recover from a snapshot.
3. **Updates.** Subscribe to releases. Security fixes go in patch releases.
4. **Acknowledgement.** AGPL requires that you make your source modifications available to users of your instance. The platform exposes a "About this instance" page (Phase E) that links to your source.

## Federation

v0.1 instances are standalone. Federation (ActivityPub) is on the v2 roadmap. Operators can already cross-link groups manually via URLs.
