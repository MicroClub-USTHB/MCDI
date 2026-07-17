FROM node:24-alpine AS builder

WORKDIR /usr/src/app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Generate a single, ordered, idempotent migration SQL file from the migration
# set. Applied at runtime via psql (no drizzle-kit needed in the prod image).
RUN apk add --no-cache postgresql-client \
  && sh -c 'mkdir -p /migrations && : > /migrations/migration.sql \
    && for f in $(ls src/database/migrations/*.sql | sort); do \
         echo "-- migration: $f" >> /migrations/migration.sql; \
         cat "$f" >> /migrations/migration.sql; \
         echo "" >> /migrations/migration.sql; \
       done'

# ── pruned: devDependencies stripped — used by the production stage only ──────
FROM builder AS pruned

RUN pnpm prune --prod

FROM node:24-alpine AS production

ENV NODE_ENV=production

RUN corepack enable \
  && apk add --no-cache postgresql-client

USER node

WORKDIR /usr/src/app

COPY --from=pruned --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=pruned --chown=node:node /usr/src/app/dist ./dist
COPY --from=pruned --chown=node:node /usr/src/app/package.json ./
COPY --from=pruned --chown=node:node /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder --chown=node:node /migrations/migration.sql /migrations/migration.sql

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
