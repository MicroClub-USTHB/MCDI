# Deploying MCDI to dokploy

MCDI is deployed as a single Compose stack described in
[`docker-compose.prod.yml`](docker-compose.prod.yml). The API image is built and
pushed by CI to GitHub Container Registry (GHCR) and **pulled** by dokploy — the
server never builds the image.

## 1. Make the GHCR package public

The CI workflow already flips the `mcdi` package to **Public** on every push to
`main`. If you ever need to do it manually:

- GitHub → repo (or org) **Packages** → `mcdi` → **Package settings** →
  **Change visibility** → **Public**.

A public package means dokploy can pull `ghcr.io/microclub-usthb/mcdi:latest`
without a registry secret.

## 2. Create the Compose deployment

1. dokploy → **Create** → **Compose**.
2. Source = this repository, branch `main`.
3. Compose file = `docker-compose.prod.yml`.
4. In the service env panel, set **all** required secrets/variables:
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (used by the API, database and redis
     services in the compose file).
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_TOKEN`,
     `DISCORD_CALLBACK_URL`, `DISCORD_ADMIN_CALLBACK_URL`.
   - `MC_GUILD_ID`, `MC_EXECUTIVE_ROLE_ID`.
   - `BASE_URL`, `CORS_ORIGINS`, `ADMIN_FRONTEND_URL`.
   - `THROTTLER_TTL_MS`, `THROTTLER_LIMIT` (optional).
5. Attach a domain + TLS to the `api` service (container port `3000`).
6. Deploy.

On boot the stack:

- waits for Postgres to report healthy,
- runs `pnpm run db:migrate:docker` (applies `migration.sql` via `psql` — idempotent),
- starts the API once the schema is in place,
- routes traffic only after `/api/health` returns `200`.

## 3. Postgres backups

The database data lives in the `pg_data` volume and **survives redeploys**, but it
is not backed up by default. Own your backups:

### Option A — dokploy scheduled backups
Enable **Scheduled Backups** for the `database` service in the dokploy UI, pointing
at your preferred off-host storage.

### Option B — cron `pg_dump` sidecar / host cron
On the dokploy host the compose file lives at
`/etc/dokploy/compose/<app-name>/code/docker-compose.prod.yml`, so either
`cd` into that directory first or pass the absolute path:

```bash
COMPOSE_FILE=/etc/dokploy/compose/<app-name>/code/docker-compose.prod.yml

# one-off dump
docker compose -f "$COMPOSE_FILE" exec -T database \
  pg_dump -U mcdi mcdi > mcdi-$(date +%F).sql

# restore
docker compose -f "$COMPOSE_FILE" exec -T database \
  psql -U mcdi mcdi < mcdi-YYYY-MM-DD.sql
```

Store dumps off-host (object storage / another machine). Test the restore path
periodically.
