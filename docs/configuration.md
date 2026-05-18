# Configuration Reference

All Earthropy configuration is done via environment variables. In production these are read from `.env.production` and injected into containers by Docker Compose.

See also: [`docs/self-host.md`](self-host.md), [`docs/operations.md`](operations.md).

---

## How variables flow

```
.env.production
    └── docker compose -f docker-compose.prod.yml --env-file .env.production up -d
            ├── postgres   (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)
            ├── app        (all vars below except POSTGRES_*)
            ├── api        (all vars below except POSTGRES_*)
            └── caddy      (DOMAIN)
```

The `app` and `api` services receive an identical set of environment variables — the Compose file in `docker-compose.prod.yml` passes the same block to both. Caddy only needs `DOMAIN`.

---

## Required variables

| Variable | Description |
|---|---|
| `DOMAIN` | Public hostname Caddy serves and issues a TLS cert for. Use a real domain for automatic HTTPS via ACME (Let's Encrypt). Use `localhost` for local testing (self-signed). |
| `DATABASE_URL` | Full Postgres connection string consumed by Drizzle / postgres-js. Must match the `POSTGRES_*` credentials. Example: `postgresql://earthropy:secret@postgres:5432/earthropy` |
| `POSTGRES_USER` | Postgres superuser name for the `postgres` container. Default: `earthropy` |
| `POSTGRES_PASSWORD` | Postgres password. **Required** — the Compose file will refuse to start without it. |
| `POSTGRES_DB` | Database name inside Postgres. Default: `earthropy` |
| `REDIS_URL` | Full Redis connection URL consumed by BullMQ (job queues) and the rate-limiter. Example: `redis://redis:6379` |
| `AUTH_SECRET` | Cryptographically random secret used to sign session tokens. Generate with: `openssl rand -base64 32`. **Required.** |

---

## Optional variables

### Email (SMTP)

Used by: `app`, `api`

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | *(empty)* | SMTP server hostname (e.g. `smtp.sendgrid.net`, `localhost`) |
| `SMTP_PORT` | `587` | SMTP port. Use 465 for SSL, 587 for STARTTLS. |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASS` | *(empty)* | SMTP password |
| `SMTP_FROM` | `noreply@localhost` | Envelope `From` address for outgoing mail |

**If not set:** magic-link authentication and email notifications are disabled. Users can still sign in with password. No email is sent under any circumstance.

Any standard SMTP relay works — Postfix, Sendgrid, Resend, Mailgun, etc.

---

### AI Moderation

Used by: `app`, `api`

Earthropy's moderation package follows a provider interface (`packages/moderation/src/provider.ts`). You can use the Anthropic cloud API, a self-hosted Ollama instance, or neither.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | API key for the Anthropic cloud API (paid). When set, the `AnthropicModerationProvider` is used. |
| `OLLAMA_URL` | Base URL of a running Ollama instance (free, self-hosted). Example: `http://ollama:11434`. When set without `ANTHROPIC_API_KEY`, the `OllamaModerationProvider` is used. |

**Priority:** If both are set, Anthropic takes precedence. If neither is set, the moderation package falls back to the no-op provider — content is accepted without AI review. Moderation decisions are still logged to `moderation_decisions` for audit purposes.

**Self-hosted Ollama:** Run Ollama as an additional Docker Compose service (not included by default) or on a separate host. A guard model such as `llama-guard3:8b` works well. Set `OLLAMA_URL` to the Ollama base URL.

---

### Object Storage (S3-compatible)

Used by: `app`, `api`

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | Base URL of your S3-compatible endpoint. Example: `https://s3.amazonaws.com` or `http://minio:9000` for a local MinIO instance. |
| `S3_BUCKET` | Bucket name. Create the bucket before starting the app. |
| `S3_ACCESS_KEY` | S3 / MinIO access key ID |
| `S3_SECRET_KEY` | S3 / MinIO secret access key |

**If not set:** file and image uploads are disabled.

**MinIO (self-hosted):** Add MinIO as a Docker Compose service and set `S3_ENDPOINT=http://minio:9000`. The MinIO console is exposed at port 9001 in the dev stack (`docker-compose.yml`). For production, add it to `docker-compose.prod.yml` and put it behind Caddy or restrict port access.

---

## Example `.env.production`

Copy `.env.production.example` and fill in your values:

```bash
cp .env.production.example .env.production
```

Minimum viable configuration (password auth only, no email, no AI moderation, no uploads):

```env
DOMAIN=earthropy.example.com
DATABASE_URL=postgresql://earthropy:strongpassword@postgres:5432/earthropy
POSTGRES_USER=earthropy
POSTGRES_PASSWORD=strongpassword
POSTGRES_DB=earthropy
REDIS_URL=redis://redis:6379
AUTH_SECRET=<output of: openssl rand -base64 32>
```

---

## Service-to-variable mapping

| Variable | `postgres` | `app` | `api` | `caddy` |
|---|:---:|:---:|:---:|:---:|
| `DOMAIN` | | | | ✓ |
| `DATABASE_URL` | | ✓ | ✓ | |
| `POSTGRES_USER` | ✓ | | | |
| `POSTGRES_PASSWORD` | ✓ | | | |
| `POSTGRES_DB` | ✓ | | | |
| `REDIS_URL` | | ✓ | ✓ | |
| `AUTH_SECRET` | | ✓ | ✓ | |
| `SMTP_*` | | ✓ | ✓ | |
| `ANTHROPIC_API_KEY` | | ✓ | ✓ | |
| `OLLAMA_URL` | | ✓ | ✓ | |
| `S3_*` | | ✓ | ✓ | |
