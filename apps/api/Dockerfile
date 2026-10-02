# Build from the repository root:
#   docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base

WORKDIR /usr/src/app

RUN corepack enable

ENV TURBO_TELEMETRY_DISABLED=1

# ── pruner: a minimal monorepo containing only @mcdi/api and the workspace
#    packages it depends on, with a matching lockfile ─────────────────────────
FROM base AS pruner

ARG TURBO_VERSION=2.11.5
RUN npm install -g turbo@${TURBO_VERSION}

COPY . .

RUN turbo prune @mcdi/api --docker

# ── builder: install (cached until a manifest changes), then build ───────────
FROM base AS builder

COPY --from=pruner /usr/src/app/out/json/ .

RUN pnpm install --frozen-lockfile

COPY --from=pruner /usr/src/app/out/full/ .

RUN pnpm turbo run build --filter=@mcdi/api

# Generate a single, ordered, idempotent migration SQL file from the migration
# set. Applied at runtime via psql (no drizzle-kit needed in the prod image).
RUN sh -c 'mkdir -p /migrations && : > /migrations/migration.sql \
    && for f in $(ls apps/api/src/database/migrations/*.sql | sort); do \
         echo "-- migration: $f" >> /migrations/migration.sql; \
         cat "$f" >> /migrations/migration.sql; \
         echo "" >> /migrations/migration.sql; \
       done'

# ── pruned-deps: production node_modules for @mcdi/api only (workspace
#    packages such as @mcdi/contracts are copied in, not symlinked) ───────────
FROM builder AS deps

RUN pnpm --filter=@mcdi/api deploy --legacy --prod /prod/api

FROM node:24-alpine AS production

ENV NODE_ENV=production

RUN apk add --no-cache postgresql-client

USER node

WORKDIR /usr/src/app

COPY --from=deps --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/apps/api/dist ./dist
COPY --from=builder --chown=node:node /usr/src/app/apps/api/package.json ./
COPY --from=builder --chown=node:node /migrations/migration.sql /migrations/migration.sql

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
