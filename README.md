<div align="center">

# MCDI

### MicroClub Discord Interface

**The identity backbone of MicroClub — one integration, every app.**

Built and maintained by the Dev Department of [MicroClub](https://github.com/MicroClub-USTHB), the CS club at USTHB, Algiers.

[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-v10-E0234E?logo=nestjs)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis)](https://redis.io)
[![Discord](https://img.shields.io/badge/Discord-OAuth2-5865F2?logo=discord)](https://discord.com/developers)

</div>

---

## What Is MCDI?

Every MicroClub app used to solve the same problem independently — Discord login, guild membership checks, role-based access. MCDI ends that duplication.

**MCDI is the single Discord identity layer for all MicroClub projects.** Projects integrate once through a simple API and get authentication, member data, and permission resolution out of the box. No repeated OAuth plumbing, no diverging role logic, no stale member caches.

---

## Features

| Area | Capabilities |
|---|---|
| **OAuth** | Project-scoped browser flows with CSRF state, validated `client_id` and `redirect_uri` |
| **API Keys** | Hash-only storage, one-time secret reveal, per-project scopes |
| **Sessions** | Short-lived callback codes exchanged for long-lived project session tokens |
| **Admin Access** | Discord OAuth gated by a configured admin role ID in the main guild |
| **Members** | Fetch by ID, search within a server, resolve effective permissions |
| **Permissions** | Single and batch checks (`ALL` / `ANY`), inheritance across servers |
| **Multi-server** | Register guilds, set a main server, enable/disable, inspect sync health |
| **Access Matrix** | Grant scopes per project/server pair with full audit history |
| **Sync** | Startup sync, manual queued syncs, live Discord gateway events |
| **Observability** | Sync logs, change history, Swagger UI, strict DTO validation |

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env
# Fill in the required Discord variables (see Configuration below)
docker-compose up --build -d
```

The stack starts NestJS, PostgreSQL, and Redis together.

| Endpoint | URL |
|---|---|
| API base | http://localhost:3000/api |
| Swagger UI | http://localhost:3000/api/docs |

### Option B — From Source

```bash
npm install
cp .env.example .env
npm run db:push
npm run start:dev
```

Optional helpers:

```bash
npm run db:seed      # seed demo data
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
```

---

## Configuration

### Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app client secret |
| `DISCORD_TOKEN` | Bot token for guild sync and role inspection |
| `DISCORD_CALLBACK_URL` | OAuth callback for project member login |
| `DISCORD_ADMIN_CALLBACK_URL` | OAuth callback for admin login |
| `MC_GUILD_ID` | Main MicroClub guild for admin access verification |
| `MC_EXECUTIVE_ROLE_ID` | Discord role ID that grants admin access in the main guild |
| `ADMIN_FRONTEND_URL` | Redirect target after successful admin login |

### Common Optional Settings

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` / `PORT` | `3000` | HTTP port |
| `API_PREFIX` | `api` | Global API prefix |
| `BASE_URL` | `http://localhost:3000` | Public base URL for redirects and docs |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_KEY_PREFIX` | `mcdi` | Redis namespace prefix |
| `PERMISSION_CACHE_TTL_MS` | `300000` | In-memory permission cache TTL (5 min) |
| `PROJECT_AUTH_CACHE_TTL_MS` | `30000` | Redis cache TTL for project auth lookups |
| `PROJECT_ACCESS_CACHE_TTL_MS` | `30000` | Redis cache TTL for project-server access |
| `PROJECT_LAST_USED_WRITE_TTL_MS` | `60000` | Write-throttle window for API key last-used updates |
| `AUTH_REQUEST_TTL_SEC` | `600` | TTL for pre-OAuth auth requests |
| `OAUTH_STATE_TTL_SEC` | `600` | TTL for Discord OAuth state rows |
| `CALLBACK_CODE_TTL_SEC` | `120` | TTL for one-time callback codes |
| `SESSION_TTL_SEC` | `2592000` | Session token TTL (30 days) |

---

## Authentication Model

MCDI handles two distinct caller types.

### Projects → MCDI

Projects authenticate with an `X-API-Key` header. Keys are stored as hashes only — the secret is shown once at creation time.

### Admins → MCDI

Admins log in via Discord OAuth and receive a bearer session token. Access is restricted to members who hold the configured admin role ID in the configured main guild.

---

## Architecture

### System Overview

<p align="center">
  <img src="./docs/assets/system-overview-graph.svg" alt="System Overview Graph" width="100%" />
</p>

### Project Login Flow

<p align="center">
  <img src="./docs/assets/login-flow-graph.svg" alt="Login Flow Graph" width="100%" />
</p>

### Discord Sync Lifecycle

<p align="center">
  <img src="./docs/assets/sync-lifecycle-graph.svg" alt="Sync Lifecycle Graph" width="100%" />
</p>

### Design Decisions

- **Modules**: `auth`, `members`, `permissions`, `projects`, `servers`, `sync`, `admin-members` — each owns its domain.
- **PostgreSQL** is the source of truth for projects, sessions, members, roles, access mappings, and sync logs.
- **Redis** handles short-lived project auth and access caching, reducing Discord API round-trips.
- **In-memory permission cache** makes repeated permission checks fast within a process lifetime.
- **Validation-first**: all DTOs are validated globally; non-whitelisted fields are rejected.
- **Swagger** is generated directly from NestJS controllers and DTOs — always in sync with the actual API.

---

## Deployment

### Development

```bash
docker-compose up --build -d

# Handy aliases
npm run docker:up           # start stack
npm run docker:up:build     # start stack with rebuild
npm run docker:down         # stop stack
npm run docker:logs         # tail logs
npm run docker:db:push      # push schema changes
npm run docker:db:seed      # seed demo data
```

### Production

The repo ships a multi-stage `Dockerfile` optimized for production image size.

```bash
docker build -t mcdi:latest .
docker run --env-file .env -p 3000:3000 mcdi:latest
```

**Runtime requirements:**

- Reachable PostgreSQL instance
- Reachable Redis instance
- Valid Discord OAuth credentials
- Valid Discord bot token (for sync and gateway features)

---

## Use Cases

- **Internal tools** — central login and role-aware access control for any MicroClub app.
- **Event platforms** — gate registration and actions based on Discord membership and role permissions.
- **Admin operations** — inspect cross-server participation, export member data, manage access.
- **Competition servers** — manage separate guilds while preserving a shared identity model.
- **New integrations** — MCDI acts as the identity and authorization layer for any future club product.

---

## Documentation

Requirements and architecture notes live under `docs/`:

| File | Contents |
|---|---|
| [`docs/specefication_document_mvp.md`](docs/specefication_document_mvp.md) | Current release scope and implemented requirements |
| [`docs/specefication_document_last_version.md`](docs/specefication_document_last_version.md) | Next-phase roadmap and architecture direction |
| [`docs/database_architecture_mvp.md`](docs/database_architecture_mvp.md) | Database architecture and schema notes |
| [`docs/specefication_file.md`](docs/specefication_file.md) | Documentation index |

---

## Roadmap

The codebase already reserves space for operations like `SEND_MESSAGES` and `MANAGE_WEBHOOKS`. Planned extensions include:

- Discord channel operations for projects
- Webhook creation and execution
- Richer server and project analytics
- Event subscriptions with outbound delivery
- SDKs or middleware packages for common frameworks

---

## Contributing

Contributions are welcome. If you're working within the club workflow:

1. Align changes with the spec documents in `docs/`.
2. Verify the API contract against the Swagger UI before opening a PR.
3. Write or update tests for any new behavior.

---

## License

This project is **UNLICENSED** and intended for internal MicroClub use unless stated otherwise.

Copyright © 2026 MicroClub — Dev Department, USTHB, Algiers.
