# Deploying Earthropy to Vercel

This guide covers deploying `apps/app` (the main authenticated application) to Vercel. The API service (`apps/api`) requires a persistent Redis connection and long-running BullMQ workers; it is better suited to a VPS or Docker deployment — see [`docs/self-host.md`](self-host.md).

---

## Prerequisites

- A [Vercel account](https://vercel.com)
- The GitHub repository pushed and accessible (public or private with Vercel access granted)
- A managed Postgres database accessible from Vercel (e.g. Neon, Supabase, or an external host)
- A managed Redis instance accessible from Vercel (e.g. Upstash Redis)

---

## Step-by-step deployment

### 1. Import the project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and click **Import Git Repository**.
2. Select the `earthropy` repository.
3. Set the **Root Directory** to `apps/app`.
   - Vercel will detect the `vercel.json` and use the configured build command automatically.

### 2. Configure the build settings

Vercel reads `apps/app/vercel.json`, which sets:

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build command | `cd ../.. && pnpm turbo build --filter=@earthropy/app` |
| Install command | `pnpm install --frozen-lockfile` |
| Output directory | `.next` |
| Region | `iad1` (US East — change to your preferred region) |

No manual overrides are required.

### 3. Set environment variables

In the Vercel dashboard under **Settings → Environment Variables**, add the following. See [`docs/configuration.md`](configuration.md) for full descriptions of each variable.

#### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full Postgres connection string (e.g. `postgresql://user:pass@host/db?sslmode=require`) |
| `REDIS_URL` | Full Redis URL (e.g. `rediss://user:pass@host:6379`) |
| `AUTH_SECRET` | 32-byte random secret — `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Public URL of this deployment (e.g. `https://app.earthropy.org`) — used for email links |

#### Optional — Email (magic links and notifications)

| Variable | Default |
|---|---|
| `SMTP_HOST` | *(disabled if unset)* |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | |
| `SMTP_PASS` | |
| `SMTP_FROM` | `noreply@localhost` |

#### Optional — AI moderation

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic cloud API key. When set, the Anthropic moderation provider is used. |
| `OLLAMA_URL` | Self-hosted Ollama base URL (e.g. `http://ollama-host:11434`). Used when `ANTHROPIC_API_KEY` is absent. |

If neither is set, the no-op moderation provider is used — content is accepted without AI review.

#### Optional — Object storage

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | S3-compatible endpoint (e.g. `https://s3.amazonaws.com`) |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY` | Access key ID |
| `S3_SECRET_KEY` | Secret access key |

File and image uploads are disabled when these are unset.

### 4. Deploy

Click **Deploy**. Vercel will:

1. Install workspace dependencies via `pnpm install --frozen-lockfile`.
2. Run `pnpm turbo build --filter=@earthropy/app`, which builds only the app and its workspace dependencies.
3. Serve the Next.js standalone output from `.next`.

### 5. Custom domain

Under **Settings → Domains**, add your domain (e.g. `app.earthropy.org`). Vercel provisions a TLS certificate automatically.

Update `NEXT_PUBLIC_APP_URL` to the final domain after it is configured, then trigger a new deployment so email links use the correct URL.

---

## Preview deployments

Every pull request automatically gets a Vercel preview deployment. Preview URLs follow the pattern `https://earthropy-app-<hash>.vercel.app`.

To make preview deployments functional:

- Set `NEXT_PUBLIC_APP_URL` to the preview URL **or** leave it unset (falls back to `http://localhost:3000` — email links will be broken but the app itself works).
- Vercel supports environment-scoped variables: you can set a different `DATABASE_URL` for preview environments pointing to a staging database.

---

## Deploying the API separately

`apps/api` runs BullMQ workers that require a persistent process. Vercel Serverless Functions are stateless and not suitable for long-running workers. Options:

- Deploy `apps/api` on a VPS (Docker, see [`docs/self-host.md`](self-host.md)).
- Use a second Vercel project for the API's HTTP endpoints only, and run the workers separately.

If the API is deployed on a separate host, set its base URL wherever the app calls it (currently via internal server-side calls; no public API URL env var is required for v0.1).

---

## Environment variable notes

- `DATABASE_URL` must use SSL in production (append `?sslmode=require` for Neon/Supabase).
- `REDIS_URL` on Upstash uses `rediss://` (TLS).
- `AUTH_SECRET` must be identical across all instances if you run multiple regions.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are only used by the Docker Compose stack and are not needed on Vercel.
- `DOMAIN` is only used by Caddy (Docker stack) and is not needed on Vercel.
