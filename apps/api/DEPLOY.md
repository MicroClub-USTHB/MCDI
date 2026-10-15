# Deploying MCID to dokploy

MCID's backend (`apps/api`) is deployed as a single Compose stack described in
[`docker-compose.prod.yml`](docker-compose.prod.yml). The API image is built and
pushed by CI to GitHub Container Registry (GHCR) and **pulled** by dokploy — the
server never builds the image. The web app (`apps/web`) is **not** part of this
stack: it is deployed on Vercel (see the root README).

The image is built from the repository root with
`docker build -f apps/api/Dockerfile .` (`turbo prune @mcid/api --docker` keeps
the build context limited to the API and the workspace packages it uses).

## 1. Make the GHCR package public (one-time)

The CI workflow builds and pushes the image to GHCR, but the package starts as
**private**. Before dokploy can pull it, make the package **Public** once:

- GitHub → org **Packages** → `mcid` → **Package settings** →
  **Change visibility** → **Public**.

A public package means dokploy can pull `ghcr.io/microclub-usthb/mcid:latest`
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
3. Compose file = `apps/api/docker-compose.prod.yml`.
4. In the service env panel, set **all** required secrets/variables:
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (used by the API, database and redis
     services in the compose file).
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_TOKEN`,
     `DISCORD_CALLBACK_URL`, `DISCORD_ADMIN_CALLBACK_URL`.
   - `MC_GUILD_ID`, `MC_EXECUTIVE_ROLE_ID`.
   - `WEBHOOK_ENCRYPTION_KEY` (64 hex characters, `openssl rand -hex 32`).
   - `INBOUND_WEBHOOK_ENCRYPTION_KEY` (64 hex characters, a separate
     `openssl rand -hex 32`; the API refuses to boot in production without it).
   - `MAX_WEBHOOKS_PER_PROJECT` (optional, defaults to `10`).
   - `BASE_URL`, `CORS_ORIGINS`, `ADMIN_FRONTEND_URL`.
   - `THROTTLER_TTL_MS`, `THROTTLER_LIMIT` (optional).
   - `IMAGE_TAG` (optional, defaults to `latest`) — see "Pinning and rolling back" below.
5. Attach a domain + TLS to the `api` service (container port `3000`).
6. Deploy.

### Pinning and rolling back

CI pushes every `main` build to GHCR as both `latest` and an immutable
`sha-<short commit>` tag (visible under the package's *Tags*). The compose file
uses `ghcr.io/microclub-usthb/mcid:${IMAGE_TAG:-latest}`:

- **Follow the newest build:** leave `IMAGE_TAG` unset (or `latest`) and redeploy.
- **Deploy or roll back to an exact build:** set `IMAGE_TAG=sha-1a2b3c4` in the
  dokploy env panel and redeploy. Switching the tag back is the rollback.

The migration file is baked into each image, so a rolled-back image applies its
own migrations; it does not undo newer ones.

### Migrations must be idempotent

The stack re-applies the whole `/migrations/migration.sql` on **every** boot
with `psql -v ON_ERROR_STOP=1`; there is no migration journal in production.
Every migration must therefore be safe to run again on a database that already
has it: use `CREATE TABLE/INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and
wrap `ADD CONSTRAINT` in a `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`
block (see `0001`–`0004`). Plain `drizzle-kit generate` output is not
idempotent — edit it before committing. CI applies the concatenated file twice
and fails if the second run errors.

On boot the stack does everything automatically — no manual seed step needed:

- waits for Postgres to report healthy,
- applies the baked-in `/migrations/migration.sql` with `psql` (creates tables + seeds the Discord
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

## 4. Moving an existing deployment to the monorepo layout

Deployments created before the monorepo used the repository-root
`docker-compose.prod.yml`, which no longer exists. Update the **existing**
dokploy Compose app instead of creating a new one: a new app gets a new compose
project name and therefore new, empty `pg_data` / `redis_data` volumes.

1. Open the existing app → **General** → set **Compose Path** to
   `./apps/api/docker-compose.prod.yml`.
2. Add `WEBHOOK_ENCRYPTION_KEY` and `INBOUND_WEBHOOK_ENCRYPTION_KEY` to the
   env panel if missing (two different `openssl rand -hex 32` values).
3. Deploy, then restart the stack once and confirm the API comes back healthy
   (proves the migrations re-apply cleanly).

## 5. Moving an existing deployment from the MCDI name to MCID

The project was renamed from MCDI to MCID (Micro Club Identity). Production
stacks created before the rename have a Postgres role and database named
`mcdi`, while `docker-compose.prod.yml` now connects as `mcid` to database
`mcid`. Rename them once, in place, before deploying the renamed stack. The
`pg_data` volume and every row in it are kept.

1. Rename the GitHub repository to `MCID` **before** merging the rename into
   `main`. CI pushes the image to `ghcr.io/<owner>/<repository>`, so after the
   rename it publishes `ghcr.io/microclub-usthb/mcid`, the image the compose
   file pulls. Make that new package **Public** (step 1 above): it is a new
   package, so the old visibility setting does not carry over.
2. Back up the database (see "Postgres backups" below).
3. In dokploy, stop the `api` service so nothing holds a connection. Keep the
   `database` service running.
4. On the dokploy host, rename the role and the database. A role cannot rename
   itself, so a temporary superuser does it (the official Postgres image
   trusts connections over the container's local socket):

   ```bash
   DB=$(docker ps --filter name=database --format '{{.Names}}' | head -n1)
   docker exec "$DB" psql -U mcdi -d postgres -c "CREATE ROLE rename_admin SUPERUSER LOGIN;"
   docker exec "$DB" psql -U rename_admin -d postgres \
     -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'mcdi';" \
     -c "ALTER DATABASE mcdi RENAME TO mcid;" \
     -c "ALTER ROLE mcdi RENAME TO mcid;"
   docker exec "$DB" psql -U mcid -d mcid -c "DROP ROLE rename_admin;"
   ```

   Check that `$DB` names this stack's database container before running the
   rest. Postgres 16 stores the password as SCRAM, which survives the rename,
   so `POSTGRES_PASSWORD` stays valid.
5. Redeploy. The API connects as `mcid`, re-applies the migrations (a no-op)
   and starts. Then restart once and check `/api/health` returns `200`.

What else changes for running clients:

- Redis keys now use the `mcid` prefix, so caches start empty and refill.
- The SSO cookie is now `mcid_sso`: members sign in with Discord once more.
- Inbound webhook senders must sign with the `X-MCID-Signature` header; the
  old header is no longer read.

## 6. Postgres backups

The database data lives in the `pg_data` volume and **survives redeploys**, but it
is not backed up by default. Own your backups:

### Option A — dokploy scheduled backups
Enable **Scheduled Backups** for the `database` service in the dokploy UI, pointing
at your preferred off-host storage.

### Option B — cron `pg_dump` sidecar / host cron
On the dokploy host the compose file lives at
`/etc/dokploy/compose/<app-name>/code/apps/api/docker-compose.prod.yml`, so either
`cd` into that directory first or pass the absolute path:

```bash
COMPOSE_FILE=/etc/dokploy/compose/<app-name>/code/apps/api/docker-compose.prod.yml

# one-off dump
docker compose -f "$COMPOSE_FILE" exec -T database \
  pg_dump -U mcid mcid > mcid-$(date +%F).sql

# restore
docker compose -f "$COMPOSE_FILE" exec -T database \
  psql -U mcid mcid < mcid-YYYY-MM-DD.sql
```

Store dumps off-host (object storage / another machine). Test the restore path
periodically.
