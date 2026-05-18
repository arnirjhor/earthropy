# Build from repo root: docker build -f apps/app/Dockerfile .

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Workspace manifests only — maximise layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY apps/app/package.json           ./apps/app/
COPY apps/api/package.json           ./apps/api/
COPY apps/docs/package.json          ./apps/docs/
COPY apps/web/package.json           ./apps/web/

COPY packages/auth/package.json          ./packages/auth/
COPY packages/comments/package.json      ./packages/comments/
COPY packages/database/package.json      ./packages/database/
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/groups/package.json        ./packages/groups/
COPY packages/i18n/package.json          ./packages/i18n/
COPY packages/moderation/package.json    ./packages/moderation/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/observability/package.json ./packages/observability/
COPY packages/posts/package.json         ./packages/posts/
COPY packages/queue/package.json         ./packages/queue/
COPY packages/ratelimit/package.json     ./packages/ratelimit/
COPY packages/sdg/package.json           ./packages/sdg/
COPY packages/trust/package.json         ./packages/trust/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Copy installed node_modules from deps stage
COPY --from=deps /repo/node_modules      ./node_modules
COPY --from=deps /repo/apps/app/node_modules ./apps/app/node_modules

# Copy full source
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter @earthropy/app build

# ─── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

# Standalone server bundle
COPY --from=build --chown=nextjs:nodejs /repo/apps/app/.next/standalone ./

# Static assets (must sit at apps/app/.next/static inside standalone)
COPY --from=build --chown=nextjs:nodejs /repo/apps/app/.next/static ./apps/app/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/app/server.js"]
