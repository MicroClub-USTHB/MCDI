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

<svg width="100%" viewBox="0 0 680 420" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14">
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
  <style>
    .box { fill: #f5f4f0; stroke: #b4b2a9; }
    .node-teal rect { fill: #e1f5ee; stroke: #0f6e56; }
    .node-coral rect { fill: #faece7; stroke: #993c1d; }
    .node-purple rect { fill: #eeedfe; stroke: #534ab7; }
    .node-amber rect { fill: #faeeda; stroke: #854f0b; }
    .node-blue rect { fill: #e6f1fb; stroke: #185fa5; }
    .th { font-weight: 600; font-size: 14px; fill: #2c2c2a; }
    .ts { font-weight: 400; font-size: 12px; fill: #5f5e5a; }
    .node-teal .th, .node-teal .ts { fill: #085041; }
    .node-coral .th, .node-coral .ts { fill: #712b13; }
    .node-purple .th, .node-purple .ts { fill: #3c3489; }
    .node-amber .th, .node-amber .ts { fill: #633806; }
    .node-blue .th, .node-blue .ts { fill: #0c447c; }
    .arr { stroke: #888780; stroke-width: 1; fill: none; }
    .dashed { stroke: #b4b2a9; stroke-width: 0.5; stroke-dasharray: 5 4; fill: none; }
  </style>
</defs>

<!-- Project -->
<g class="node-teal">
  <rect x="20" y="50" width="140" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="90" y="72" text-anchor="middle" dominant-baseline="central">Project</text>
  <text class="ts" x="90" y="90" text-anchor="middle" dominant-baseline="central">X-API-Key</text>
</g>
<!-- Admin -->
<g class="node-coral">
  <rect x="20" y="130" width="140" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="90" y="152" text-anchor="middle" dominant-baseline="central">Admin frontend</text>
  <text class="ts" x="90" y="170" text-anchor="middle" dominant-baseline="central">Discord OAuth</text>
</g>

<!-- MCDI API -->
<g class="node-purple">
  <rect x="210" y="80" width="140" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="280" y="108" text-anchor="middle" dominant-baseline="central">MCDI API</text>
</g>

<!-- Arrows: callers → API -->
<line x1="160" y1="78" x2="208" y2="100" class="arr" marker-end="url(#arrow)"/>
<line x1="160" y1="158" x2="208" y2="116" class="arr" marker-end="url(#arrow)"/>

<!-- Modules container -->
<rect x="200" y="168" width="280" height="216" rx="12" class="dashed"/>
<text class="ts" x="340" y="186" text-anchor="middle">modules</text>

<!-- Module boxes -->
<g class="node-purple">
  <rect x="220" y="194" width="108" height="40" rx="6" stroke-width="0.5"/>
  <text class="th" x="274" y="214" text-anchor="middle" dominant-baseline="central">Auth</text>
</g>
<g class="node-purple">
  <rect x="352" y="194" width="108" height="40" rx="6" stroke-width="0.5"/>
  <text class="th" x="406" y="214" text-anchor="middle" dominant-baseline="central">Members</text>
</g>
<g class="node-purple">
  <rect x="220" y="248" width="108" height="40" rx="6" stroke-width="0.5"/>
  <text class="th" x="274" y="268" text-anchor="middle" dominant-baseline="central">Permissions</text>
</g>
<g class="node-purple">
  <rect x="352" y="248" width="108" height="40" rx="6" stroke-width="0.5"/>
  <text class="th" x="406" y="268" text-anchor="middle" dominant-baseline="central">Projects</text>
</g>
<g class="node-purple">
  <rect x="220" y="302" width="108" height="40" rx="6" stroke-width="0.5"/>
  <text class="th" x="274" y="322" text-anchor="middle" dominant-baseline="central">Servers</text>
</g>
<g class="node-purple">
  <rect x="352" y="302" width="108" height="40" rx="6" stroke-width="0.5"/>
  <text class="th" x="406" y="322" text-anchor="middle" dominant-baseline="central">Sync</text>
</g>

<!-- Arrow: API → Modules -->
<line x1="280" y1="136" x2="280" y2="190" class="arr" marker-end="url(#arrow)"/>

<!-- Storage -->
<g class="node-amber">
  <rect x="530" y="90" width="130" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="595" y="112" text-anchor="middle" dominant-baseline="central">PostgreSQL</text>
  <text class="ts" x="595" y="130" text-anchor="middle" dominant-baseline="central">source of truth</text>
</g>
<g class="node-blue">
  <rect x="530" y="168" width="130" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="595" y="190" text-anchor="middle" dominant-baseline="central">Redis</text>
  <text class="ts" x="595" y="208" text-anchor="middle" dominant-baseline="central">short-lived cache</text>
</g>
<g class="node-teal">
  <rect x="530" y="246" width="130" height="56" rx="8" stroke-width="0.5"/>
  <text class="th" x="595" y="268" text-anchor="middle" dominant-baseline="central">Discord</text>
  <text class="ts" x="595" y="286" text-anchor="middle" dominant-baseline="central">Gateway + REST</text>
</g>

<!-- Arrows: modules → storage -->
<line x1="480" y1="270" x2="528" y2="118" class="arr" marker-end="url(#arrow)"/>
<line x1="480" y1="280" x2="528" y2="196" class="arr" marker-end="url(#arrow)"/>
<line x1="480" y1="322" x2="528" y2="270" class="arr" marker-end="url(#arrow)"/>
</svg>

### Project Login Flow

<svg width="100%" viewBox="0 0 680 530" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui,sans-serif">
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>
<rect x="20" y="20" width="100" height="40" rx="8" fill="#f1efe8" stroke="#5f5e5a" stroke-width="0.5"/>
<text x="70" y="40" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#2c2c2a">User</text>
<rect x="178" y="20" width="104" height="40" rx="8" fill="#e1f5ee" stroke="#0f6e56" stroke-width="0.5"/>
<text x="230" y="40" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#085041">Project</text>
<rect x="340" y="20" width="100" height="40" rx="8" fill="#eeedfe" stroke="#534ab7" stroke-width="0.5"/>
<text x="390" y="40" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#3c3489">MCDI</text>
<rect x="494" y="20" width="116" height="40" rx="8" fill="#e6f1fb" stroke="#185fa5" stroke-width="0.5"/>
<text x="552" y="40" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#0c447c">Discord</text>
<line x1="70"  y1="60" x2="70"  y2="510" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="4 3"/>
<line x1="230" y1="60" x2="230" y2="510" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="4 3"/>
<line x1="390" y1="60" x2="390" y2="510" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="4 3"/>
<line x1="552" y1="60" x2="552" y2="510" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="4 3"/>
<line x1="75" y1="96" x2="225" y2="96" stroke="#0f6e56" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="148" y="90" text-anchor="middle" font-size="12" fill="#5f5e5a">1  Login with Discord</text>
<line x1="235" y1="131" x2="385" y2="131" stroke="#534ab7" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="308" y="125" text-anchor="middle" font-size="12" fill="#5f5e5a">2  Initiate OAuth flow</text>
<path d="M390 162 Q422 162 422 174 Q422 186 390 186" fill="none" stroke="#b4b2a9" stroke-width="0.5" marker-end="url(#arrow)"/>
<text x="436" y="178" font-size="12" fill="#5f5e5a">3  Validate project</text>
<line x1="385" y1="216" x2="76" y2="216" stroke="#534ab7" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="228" y="210" text-anchor="middle" font-size="12" fill="#5f5e5a">4  Redirect to Discord</text>
<line x1="76" y1="251" x2="546" y2="251" stroke="#185fa5" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="310" y="245" text-anchor="middle" font-size="12" fill="#5f5e5a">5  Authorize</text>
<line x1="546" y1="286" x2="396" y2="286" stroke="#185fa5" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="472" y="280" text-anchor="middle" font-size="12" fill="#5f5e5a">6  code + state</text>
<line x1="396" y1="321" x2="546" y2="321" stroke="#185fa5" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="472" y="315" text-anchor="middle" font-size="12" fill="#5f5e5a">7  Exchange code + identity</text>
<line x1="385" y1="361" x2="236" y2="361" stroke="#534ab7" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="310" y="355" text-anchor="middle" font-size="12" fill="#5f5e5a">8  Redirect + callback code</text>
<line x1="236" y1="396" x2="385" y2="396" stroke="#534ab7" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="310" y="390" text-anchor="middle" font-size="12" fill="#5f5e5a">9  Exchange callback code</text>
<line x1="385" y1="436" x2="236" y2="436" stroke="#534ab7" stroke-width="1" fill="none" marker-end="url(#arrow)"/>
<text x="310" y="430" text-anchor="middle" font-size="12" fill="#5f5e5a">10  Session token + member context</text>
</svg>

### Discord Sync Lifecycle

<svg width="100%" viewBox="0 0 680 500" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14">
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
  <style>
    .th { font-weight: 600; font-size: 13px; fill: #2c2c2a; }
    .ts { font-weight: 400; font-size: 11px; fill: #5f5e5a; }
    .arr { stroke: #888780; stroke-width: 1; fill: none; }
    .n-teal rect { fill: #e1f5ee; stroke: #0f6e56; } .n-teal .th { fill: #085041; } .n-teal .ts { fill: #085041; }
    .n-purple rect { fill: #eeedfe; stroke: #534ab7; } .n-purple .th { fill: #3c3489; } .n-purple .ts { fill: #3c3489; }
    .n-gray rect { fill: #f1efe8; stroke: #888780; } .n-gray .th { fill: #2c2c2a; } .n-gray .ts { fill: #5f5e5a; }
    .n-amber rect { fill: #faeeda; stroke: #854f0b; } .n-amber .th { fill: #633806; }
    .n-coral rect { fill: #faece7; stroke: #993c1d; } .n-coral .th { fill: #712b13; }
    .n-blue rect { fill: #e6f1fb; stroke: #185fa5; } .n-blue .th { fill: #0c447c; } .n-blue .ts { fill: #0c447c; }
  </style>
</defs>

<!-- LEFT COLUMN: startup sync -->
<g class="n-teal">
  <rect x="40" y="20" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="140" y="42" text-anchor="middle" dominant-baseline="central">Discord bot ready</text>
</g>
<line x1="140" y1="64" x2="140" y2="94" class="arr" marker-end="url(#arrow)"/>

<g class="n-purple">
  <rect x="40" y="94" width="200" height="52" rx="8" stroke-width="0.5"/>
  <text class="th" x="140" y="112" text-anchor="middle" dominant-baseline="central">Queue startup sync</text>
  <text class="ts" x="140" y="130" text-anchor="middle" dominant-baseline="central">for all active servers</text>
</g>
<line x1="140" y1="146" x2="140" y2="176" class="arr" marker-end="url(#arrow)"/>

<g class="n-purple">
  <rect x="40" y="176" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="140" y="198" text-anchor="middle" dominant-baseline="central">Sync worker drains queue</text>
</g>
<line x1="140" y1="220" x2="140" y2="250" class="arr" marker-end="url(#arrow)"/>

<g class="n-gray">
  <rect x="40" y="250" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="140" y="272" text-anchor="middle" dominant-baseline="central">Sync server metadata</text>
</g>
<line x1="140" y1="294" x2="140" y2="324" class="arr" marker-end="url(#arrow)"/>

<g class="n-gray">
  <rect x="40" y="324" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="140" y="346" text-anchor="middle" dominant-baseline="central">Sync roles + permissions</text>
</g>
<line x1="140" y1="368" x2="140" y2="398" class="arr" marker-end="url(#arrow)"/>

<g class="n-gray">
  <rect x="40" y="398" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="140" y="420" text-anchor="middle" dominant-baseline="central">Sync members</text>
</g>
<line x1="140" y1="442" x2="140" y2="464" class="arr" marker-end="url(#arrow)"/>

<g class="n-amber">
  <rect x="40" y="464" width="200" height="24" rx="6" stroke-width="0.5"/>
  <text class="th" x="140" y="476" text-anchor="middle" dominant-baseline="central">Write sync log + changes</text>
</g>

<!-- CENTER: shared outcome -->
<g class="n-coral">
  <rect x="268" y="464" width="144" height="24" rx="6" stroke-width="0.5"/>
  <text class="th" x="340" y="476" text-anchor="middle" dominant-baseline="central">Invalidate caches</text>
</g>
<line x1="240" y1="476" x2="266" y2="476" class="arr" marker-end="url(#arrow)"/>

<!-- RIGHT COLUMN: gateway events -->
<g class="n-blue">
  <rect x="440" y="20" width="200" height="44" rx="8" stroke-width="0.5"/>
  <text class="th" x="540" y="42" text-anchor="middle" dominant-baseline="central">Discord gateway event</text>
</g>
<line x1="540" y1="64" x2="540" y2="94" class="arr" marker-end="url(#arrow)"/>

<g class="n-gray">
  <rect x="440" y="94" width="200" height="52" rx="8" stroke-width="0.5"/>
  <text class="th" x="540" y="112" text-anchor="middle" dominant-baseline="central">Member join / leave</text>
  <text class="ts" x="540" y="130" text-anchor="middle" dominant-baseline="central">Incremental member update</text>
</g>
<line x1="540" y1="146" x2="540" y2="176" class="arr" marker-end="url(#arrow)"/>

<g class="n-gray">
  <rect x="440" y="176" width="200" height="52" rx="8" stroke-width="0.5"/>
  <text class="th" x="540" y="194" text-anchor="middle" dominant-baseline="central">Role created / updated</text>
  <text class="ts" x="540" y="212" text-anchor="middle" dominant-baseline="central">Incremental role update</text>
</g>
<line x1="540" y1="228" x2="540" y2="258" class="arr" marker-end="url(#arrow)"/>

<g class="n-gray">
  <rect x="440" y="258" width="200" height="52" rx="8" stroke-width="0.5"/>
  <text class="th" x="540" y="276" text-anchor="middle" dominant-baseline="central">Guild updated</text>
  <text class="ts" x="540" y="294" text-anchor="middle" dominant-baseline="central">Guild metadata update</text>
</g>

<!-- Gateway outcomes → invalidate (fanned paths) -->
<path d="M440 120 L416 120 L416 476 L414 476" fill="none" stroke="#888780" stroke-width="0.5" marker-end="url(#arrow)"/>
<path d="M440 202 L420 202 L420 476" fill="none" stroke="#888780" stroke-width="0.5"/>
<path d="M440 284 L424 284 L424 476" fill="none" stroke="#888780" stroke-width="0.5"/>
</svg>

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
