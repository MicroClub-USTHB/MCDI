# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Repository

MCDI (MicroClub Discord Identity/Interface) is a pnpm 10 + Turborepo monorepo (Node >= 22):

- `apps/api` (`@mcdi/api`): NestJS 11 API, Drizzle ORM + Postgres, Redis, discord.js bot. CommonJS. Shipped as a Docker image.
- `apps/web` (`@mcdi/web`): Next.js 16 admin panel, deployed on Vercel. It has its own `apps/web/CLAUDE.md` / `AGENTS.md` with frontend conventions; read them before touching web code. Next.js 16 differs from training data: check `apps/web/node_modules/next/dist/docs/` before writing Next code.
- `packages/contracts` (`@mcdi/contracts`): wire types and constants shared by api and web (e.g. the `admin_session` cookie name). It is a **compiled** package (CJS + .d.ts) because the API cannot load a just-in-time TS package. Keep it dependency-free.
- `packages/typescript-config`, `packages/eslint-config`: config-only presets that apps extend.
- `docs/`: historical design records (specifications, the inbound webhooks PRD, the original auth guide). They are no longer updated. The current documentation is in `apps/web/src/content/docs`, see Documentation below.

## Commands

Run from the repository root. Every turbo task depends on `^build`, so `@mcdi/contracts` builds first automatically.

```bash
pnpm install
pnpm dev            # contracts watch-build, API on :3000, web on :3002
pnpm build
pnpm lint           # NOTE: the API lint script runs eslint --fix
pnpm typecheck
pnpm test           # Jest (api) + Vitest (web)
pnpm test:e2e       # API e2e, needs Postgres
pnpm turbo run test --filter=@mcdi/web
```

CI (`.github/workflows/ci.yml`) runs `pnpm turbo run lint typecheck`, `test:ci` (with coverage), `build`, then API e2e against Postgres 16.

### API (`pnpm --filter @mcdi/api run <script>` or from `apps/api`)

- Single test file: `pnpm --filter @mcdi/api exec jest src/modules/auth/auth.service.spec.ts`. Filter by name with `-t "name"`.
- Unit specs live next to source (`src/**/*.spec.ts`). The coverage thresholds in `jest.config.cjs` are enforced: lines 80, functions 75, branches 68, statements 80.
- E2E specs live in `test/*.e2e-spec.ts` and use `test/helpers/` (`create-app.ts` mirrors `main.ts` setup, `db.ts` seeds and clears tables, `discord-mock.ts`). Run against a fresh DB: `RESET_DB=1 pnpm run db:migrate` drops and recreates the database, then `pnpm run test:e2e`.
- DB: `db:generate` (drizzle-kit migration from entity changes), `db:migrate`, `db:seed`, `db:studio`. Schema lives in `src/database/entities/*.entity.ts`. Migrations live in `src/database/migrations`.
- Local stack (API + Postgres + Redis): `cd apps/api && docker compose up --build -d`. Swagger is at `http://localhost:3000/api/docs`.

### Web (from `apps/web`)

- Single test: `pnpm --filter @mcdi/web exec vitest run tests/path/to/file.test.tsx`. Tests live under `tests/` only (not `src/`), use jsdom, RTL and MSW.
- Playwright: `e2e:install`, `e2e:auth`, `e2e:test`.

## API architecture

- `src/main.ts` holds global setup. `test/helpers/create-app.ts` must stay in sync with it:
  - `rawBody: true` because inbound-webhook HMAC verification signs the unparsed body.
  - JSON body limit is 512kb (base64 avatars).
  - Global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted`, so unknown DTO fields return 400. Swagger schemas are patched with `additionalProperties: false` to match (used by Schemathesis/RESTler fuzzing in `docker-compose.fuzz.yml`).
  - `PostgresExceptionFilter` maps DB errors.
  - Global prefix `api`, except the legacy EJS pages `GET /admin` and `GET /admin/login`.
- `app.module.ts` registers the global `ServerActiveGuard` (APP_GUARD), the throttler, `MethodNotAllowedMiddleware`, and `AuditLoggingMiddleware` on every route. Audit rows only cover the admin mutations listed in that middleware's route map.
- Domain modules in `src/modules/*` follow controller → service → repository. Repositories inject the Drizzle instance via the `DRIZZLE` token (`src/database/database.constants.ts`, type `DrizzleDB`). `DatabaseModule` is global. `DatabaseInitService` auto-runs migrations and bootstraps the main server from `MC_GUILD_ID` on startup (e2e tests override it).
- Two auth models (guards in `src/common/guards`):
  - **Projects** call with `X-API-Key` (`prefix.secret`, stored hash-only) through `ApiKeyGuard`. Access is scoped per project–server pair with `@RequireScope` / `@RequireProjectOperation` decorators. User login uses OAuth: `/auth/sso/authorize` (SSO-aware, `mcdi_sso` cookie) or `/auth/authorize` (always via Discord). Both return a one-time code, which the project backend exchanges for a session token.
  - **Admins** log in via Discord OAuth; any member of the `MC_GUILD_ID` guild can sign in. They get a session (the `admin_session` cookie, or a Bearer token) checked by `AdminAccessGuard`, which accepts only sessions issued by the admin login, never a project's, and then compares the member's level on the endpoint's resource (`none < read < write < manage`) with the level the handler declares through `@RequirePermission(resource, level)`. A handler that declares nothing (`@AdminSessionOnly()` and `@RootOnly()` are the two exceptions) is refused, and `src/common/guards/admin-access-coverage.spec.ts` pins the classification of every admin route, so a new admin endpoint must be added there. Members holding `MC_EXECUTIVE_ROLE_ID`, or the optional `MC_DEV_LEADS_ROLE_ID` or `MC_IT_LEADS_ROLE_ID`, are root and hold `manage` on everything.
- Caching: Redis caches project auth and project-server access (`project-auth-cache`, `project-access-cache` services) and each member's resolved permissions (`permission-cache.service`, 5 minutes). When Redis is unavailable the API falls back to the database. Invalidate these caches when you change the underlying data.
- `sync` keeps Postgres in step with Discord: startup sync, queued manual syncs, and gateway events (`sync.listener.ts`). Postgres is the source of truth that the API reads. Discord is reached via `modules/discord`.
- `inbound-webhooks` has separate admin, ingest (HMAC-signed) and read controllers. `ProjectsModule` is imported only for `ApiKeyGuard` dependencies. Keep that dependency one-way.

## Dependencies

Put security pins in `overrides` in `pnpm-workspace.yaml`. Prefer scoped overrides (`jsdom>undici`, `msw>path-to-regexp`): global pins broke the web test tooling.

## Documentation

The developer documentation is MDX in `apps/web/src/content/docs`, served at `/docs` by the web app. `apps/web/src/features/docs/nav.ts` lists every page and is the only place a page is registered. To add one, create the `.mdx` file (no title heading, end with a `Source:` line naming the files it describes), add its entry to `nav.ts`, and run `pnpm --filter @mcdi/web exec vitest run tests/features/docs`. See `apps/web/src/content/docs/build/writing-docs.mdx`.

- The API reference under `api-reference/` is generated. After you change an endpoint, a DTO or a Swagger decorator, run `pnpm docs:api` and commit the result. CI fails when it is out of date.
- Update the hand-written pages in the same pull request when you change behaviour they describe. Tests check that every environment variable is documented and that the code excerpts in the API and web guides still match their files.
- Prose uses plain hyphens, no em or en dashes, in the present tense, and describes what the code does.

