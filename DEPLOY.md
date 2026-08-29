# Deploying MCDI to dokploy

MCDI is deployed as a single Compose stack described in
[`docker-compose.prod.yml`](docker-compose.prod.yml). The API image is built and
pushed by CI to GitHub Container Registry (GHCR) and **pulled** by dokploy — the
server never builds the image.

## 1. Make the GHCR package public (one-time)

The CI workflow builds and pushes the image to GHCR, but the package starts as
**private**. Before dokploy can pull it, make the package **Public** once:

- GitHub → org **Packages** → `mcdi` → **Package settings** →
  **Change visibility** → **Public**.

A public package means dokploy can pull `ghcr.io/microclub-usthb/mcdi:latest`
without registry credentials. You only need to do this once — subsequent pushes
keep the visibility setting.

## 2. Configure the GHCR registry in dokploy

Even though the image is public, dokploy needs a registry entry for GHCR
to resolve the image host:

1. dokploy → **Registry** → **Add Registry**.
2. Fill in:
   - **Registry Name**: `GitHub Container Registry`
   - **Registry URL**: `ghcr.io`
   - **Username**: *(leave empty for public images)*
   - **Password**: *(leave empty for public images)*
   - **Image Prefix**: *(leave empty)*
3. Click **Test** to verify the connection, then **Create**.

## 3. Create the Compose deployment

1. dokploy → **Create** → **Compose**.
2. Source = this repository, branch `main`.
3. Compose file = `docker-compose.prod.yml`.
4. In the service env panel, set **all** required secrets/variables:
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (used by the API, database and redis
     services in the compose file).
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_TOKEN`,
     `DISCORD_CALLBACK_URL`, `DISCORD_ADMIN_CALLBACK_URL`.
   - `MC_GUILD_ID`, `MC_EXECUTIVE_ROLE_ID`.
   - `WEBHOOK_ENCRYPTION_KEY` (64 hex characters, `openssl rand -hex 32`).
   - `MAX_WEBHOOKS_PER_PROJECT` (optional, defaults to `10`).
   - `BASE_URL`, `CORS_ORIGINS`, `ADMIN_FRONTEND_URL`.
   - `THROTTLER_TTL_MS`, `THROTTLER_LIMIT` (optional).
5. Attach a domain + TLS to the `api` service (container port `3000`).
6. Deploy.

On boot the stack does everything automatically — no manual seed step needed:

- waits for Postgres to report healthy,
- runs `pnpm run db:migrate:docker` (creates tables + seeds the Discord
  permission catalog — idempotent),
- starts the API, which auto-creates a `servers` row from `MC_GUILD_ID` when
  the table is empty (first boot only),
- routes traffic only after `/api/health` returns `200`.

After deploy:

- The Discord sync (runs automatically on an interval) populates **real**
  roles, members, and role-permission grants from your Discord guild.
- An Executive-role member logs in via Discord admin OAuth and creates real
  projects via the admin panel (or API).
- The system is live with 100% production data — zero seed fixtures, zero
  fake API keys, zero backdoor sessions.

## 4. Postgres backups

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
