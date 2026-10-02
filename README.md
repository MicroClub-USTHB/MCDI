# MCDI

MicroClub Discord Identity — the NestJS API that centralises Discord identity and access, and the Next.js admin panel that manages it. One pnpm + [Turborepo](https://turborepo.dev) monorepo.

```
apps/
  api/                 NestJS 11 API (Drizzle + Postgres + Redis) — deployed with Docker
  web/                 Next.js 16 admin panel                    — deployed on Vercel
packages/
  contracts/           Types and constants shared by api and web (compiled, CJS + .d.ts)
  typescript-config/   Base / nestjs / nextjs / library tsconfig presets
  eslint-config/       Shared ESLint flat-config base (typescript-eslint + prettier)
docs/                  Specifications and architecture notes
```

Workspace packages are named `@mcdi/*`: `@mcdi/api`, `@mcdi/web`, `@mcdi/contracts`, `@mcdi/typescript-config`, `@mcdi/eslint-config`.

## Getting started

Requires Node.js >= 22 and pnpm 10 (`corepack enable` picks the pinned version from `package.json`).

```bash
pnpm install                 # once, at the repository root
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm dev                     # api on :3000 and web on :3002 (needs Postgres + Redis, see below)
```

The API needs Postgres and Redis. The easiest way is the dev compose stack, which also runs the API itself:

```bash
cd apps/api && docker compose up --build -d     # see apps/api/README.md
```

## Commands

Run from the repository root; Turborepo runs them per package in dependency order and caches the results.

| Command | What it does |
|---|---|
| `pnpm dev` | Watch-builds `@mcdi/contracts`, runs the API and the web app |
| `pnpm build` | Builds everything (contracts → api, web) |
| `pnpm lint` | ESLint (note: the API's `lint` runs with `--fix`) |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | Unit tests (Jest for the API, Vitest for the web) |
| `pnpm test:e2e` | API end-to-end tests (needs Postgres, see `.github/workflows/ci.yml`) |

Target one package with a filter, e.g. `pnpm turbo run test --filter=@mcdi/web`, or run a script inside it: `pnpm --filter @mcdi/api run db:migrate`.

## How the packages fit together

- **`@mcdi/contracts`** is a *compiled* internal package. The API is CommonJS and resolves modules the classic way, so a just-in-time TypeScript package would not load there. Every task that imports it depends on `^build` in `turbo.json`, so `pnpm build`/`test`/`typecheck` build it first; in `pnpm dev` it rebuilds on change. Keep it dependency-free and limited to things both sides really share (wire types, enum-like unions, the `admin_session` cookie name, …).
- **`@mcdi/typescript-config`** and **`@mcdi/eslint-config`** are config-only packages. Apps extend them (`"extends": "@mcdi/typescript-config/nextjs.json"`, `import base from '@mcdi/eslint-config/base'`) and keep only their own overrides.
- Dependency versions that must be pinned for security live in `overrides` in `pnpm-workspace.yaml`. Some are scoped (`jsdom>undici`, `msw>path-to-regexp`) because a global pin broke the web test tooling — prefer scoped overrides.

## Deployment

### API — Docker (dokploy)

Only the backend ships as a container. CI builds and pushes the image to GHCR on `main`:

```bash
docker build -f apps/api/Dockerfile .      # run from the repository root
```

The Dockerfile uses `turbo prune @mcdi/api --docker`, so the image contains only the API and the workspace packages it depends on. Compose files live in `apps/api/` (`docker-compose.yml` for dev, `docker-compose.prod.yml` for dokploy, `docker-compose.fuzz.yml` for fuzzing). See [`apps/api/DEPLOY.md`](apps/api/DEPLOY.md).

### Web — Vercel

The web app is not containerised. Import the repository in Vercel as a project with:

| Setting | Value |
|---|---|
| Root Directory | `apps/web` (keep *Include source files outside of the Root Directory* enabled) |
| Build Command | `cd ../.. && pnpm turbo run build --filter=@mcdi/web` (builds `@mcdi/contracts` first) |
| Ignored Build Step | `npx turbo-ignore @mcdi/web` |
| Environment variables | `NEXT_PUBLIC_API_URL` (API URL including `/api`), `NEXT_PUBLIC_APP_URL` |

Add the Vercel domain to `CORS_ORIGINS` on the API.

## CI

`.github/workflows/ci.yml` runs lint + typecheck, unit tests with coverage and a full build for every push/PR to `main` and `dev`, API e2e tests against Postgres, and the API image build on `main`.
