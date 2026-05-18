# syntax=docker/dockerfile:1
# Build from repo root: docker build -f apps/api/Dockerfile .

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Root manifest + lock
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# App manifests
COPY apps/api/package.json          ./apps/api/package.json
COPY apps/app/package.json          ./apps/app/package.json
COPY apps/docs/package.json         ./apps/docs/package.json
COPY apps/web/package.json          ./apps/web/package.json

# Package manifests
COPY packages/auth/package.json          ./packages/auth/package.json
COPY packages/comments/package.json      ./packages/comments/package.json
COPY packages/database/package.json      ./packages/database/package.json
COPY packages/design-system/package.json ./packages/design-system/package.json
COPY packages/groups/package.json        ./packages/groups/package.json
COPY packages/i18n/package.json          ./packages/i18n/package.json
COPY packages/moderation/package.json    ./packages/moderation/package.json
COPY packages/notifications/package.json ./packages/notifications/package.json
COPY packages/observability/package.json ./packages/observability/package.json
COPY packages/posts/package.json         ./packages/posts/package.json
COPY packages/queue/package.json         ./packages/queue/package.json
COPY packages/ratelimit/package.json     ./packages/ratelimit/package.json
COPY packages/sdg/package.json           ./packages/sdg/package.json
COPY packages/trust/package.json         ./packages/trust/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /repo

# Reuse installed node_modules from deps stage
COPY --from=deps /repo/node_modules        ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules

# Copy full source
COPY . .

RUN pnpm --filter @earthropy/api build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002

WORKDIR /app

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server bundle
COPY --from=builder --chown=nextjs:nodejs /repo/apps/api/.next/standalone ./

# Static assets
COPY --from=builder --chown=nextjs:nodejs /repo/apps/api/.next/static ./apps/api/.next/static

USER nextjs

EXPOSE 3002

# next.config.ts output:'standalone' emits apps/api/server.js inside the bundle
CMD ["node", "apps/api/server.js"]
