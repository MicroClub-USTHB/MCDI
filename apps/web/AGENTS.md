<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# MCDI-Front — Agent Instructions

> This file is consumed by all AI coding agents (Claude Code, OpenCode, Copilot, Cursor, etc.)

## 1. Project Overview & Tech Stack

**MCDI** (MicroClub Discord Interface) is a full-stack admin platform for managing MicroClub's Discord infrastructure. This repo is the **frontend SPA** — a Next.js 16 app with a Discord-inspired dark-only design system.

| Layer | Stack |
|---|---|
| Framework | Next.js 16.2.2 (App Router, deployed on Vercel) |
| Language | TypeScript 5 (strict mode, `noUncheckedIndexedAccess`) |
| Styling | Tailwind CSS v4 (CSS-based `@theme`, no JS config) |
| Server State | TanStack React Query v5 |
| Client State | Zustand v5 (persist middleware) |
| UI Primitives | Radix UI |
| Icons | Lucide React |
| Validation | Zod v4 |
| Testing | Vitest + RTL + MSW |
| Linting | ESLint 9 (flat config) + Prettier |

**Backend**: NestJS REST API at `NEXT_PUBLIC_API_URL`. Full spec: `../../docs/MCDI-V2-SPECIFICATION.md`.

## 2. Architecture & Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root: DM Sans + JetBrains Mono
│   ├── page.tsx                  # Landing
│   ├── providers.tsx             # QueryProvider wrapper
│   └── (dashboard)/              # Auth-guarded route group
├── features/                     # Feature-sliced modules (self-contained)
│   ├── auth/                     # Has stores/ and api/
│   ├── channels/ members/ monitoring/ projects/
│   ├── roles/ servers/ settings/ stats/ sync/ webhooks/
├── providers/                    # React context providers
├── shared/                       # Cross-cutting
│   ├── components/common/        # ErrorBoundary, LoadingSkeleton
│   ├── lib/                      # api-client, env, utils (cn)
│   ├── styles/globals.css        # Design tokens (@theme)
│   └── types/index.ts            # Shared interfaces
└── middleware.ts                 # Cookie-based auth redirect
```

**Path alias**: `@/` → `./src/`

## 3. Code Style & Gotchas

### Enforced Rules

- **No `any`**: Use `unknown` and narrow. ESLint errors on `any`.
- **Type imports**: Always `import type { Foo }` for type-only imports.
- **Unused vars**: Prefix with `_` or remove. ESLint errors.
- **No default exports**: Except Next.js pages and layouts.
- **No comments**: Unless explaining a non-obvious "why".
- **`cn()` for classes**: Always use `cn()` from `@/shared/lib/utils` for conditional classes.

### Gotchas

1. **Next.js 16**: Check `node_modules/next/dist/docs/` before using any Next.js API.
2. **No `tailwind.config.ts`**: Tailwind v4 uses `@theme` in CSS. Don't recreate a JS config.
3. **Dark-only**: No light mode, no `dark:` prefixed classes, no theme toggle, no `ThemeProvider`.
4. **Auth singleton**: `apiClient` reads Zustand state via `getState()` — no React context needed. Never create a second instance.
5. **Token refresh dedup**: Concurrent 401s share a single refresh promise. Don't bypass this.
6. **Env validation**: `env.ts` throws at import time if vars are missing. Intentional.
7. **Middleware deprecation**: Next.js 16 warns about `middleware.ts`. Use `proxy` convention when migrating.

## 4. UI & Design System

### V2 Design System — Discord-Inspired Dark Theme

All tokens defined in `src/shared/styles/globals.css` via `@theme`.

**Brand** (Discord Blurple): `brand` (#5865F2), `brand-hover` (#4752C4), `brand-active` (#3C45A5), `brand-light` (#8B9CFC), `brand-tint` (rgba)

**Surfaces** (Layered Dark): `surface-base` (#1E1F22), `surface-raised` (#2B2D31), `surface-main` (#313338), `surface-hover` (#35363C), `surface-active` (#404249), `surface-elevated` (#4E5058)

**Text**: `text-primary` (#F2F3F5), `text-normal` (#DBDEE1), `text-muted` (#B5BAC1), `text-subtle` (#949BA4), `text-faint` (#6D6F78)

**Semantic**: `success` (#23A559), `error` (#DA373C), `warning` (#F0B232), `info` (#5865F2), `accent` (#EB459E)

**Border**: `border` (#3F4147), `border-hover` (#4E5058), `border-focus` (#5865F2)

**Typography**: DM Sans (body/headings) + JetBrains Mono (code). 4px spacing grid.

### Rules

- Use token names in Tailwind classes: `bg-surface-base`, `text-text-muted`, `border-border`
- Never hardcode hex colors
- Never use `dark:` classes
- Use `lucide-react` for all icons

## 5. Workflow & Commands

```bash
# Development
pnpm run dev              # Dev server (localhost:3002)
pnpm run build            # Production build
pnpm run start            # Production server

# Quality
pnpm run lint             # ESLint check
pnpm run lint:fix         # ESLint auto-fix
pnpm run format           # Prettier write
pnpm run format:check     # Prettier check
pnpm run typecheck        # tsc --noEmit

# Testing
pnpm run test             # Vitest watch
pnpm run test:coverage    # Coverage report
pnpm run test:ui          # Vitest UI
```

### Pre-commit: `typecheck` → `lint` → `format:check` → `build`

## 6. Agent Brief & Persona

You are a **senior frontend engineer** building a Discord-inspired admin panel. Priorities:

1. **Design system compliance** — every element uses V2 tokens
2. **Type safety** — strict TypeScript, no `any`, no unchecked access
3. **Feature isolation** — self-contained modules, shared logic in `@/shared/`
4. **Server state** — React Query for async, Zustand for client-only
5. **Accessibility** — semantic HTML, ARIA, keyboard nav, focus management

### New Feature Checklist

1. Create `src/features/<name>/` with `types/`, `api/`, `stores/`, `components/`
2. Export public API via `index.ts` barrel
3. Add route: `src/app/(dashboard)/<name>/page.tsx`
4. Use shared components and design tokens
5. Write tests in `tests/`

## 7. Build & Test Requirements

- `pnpm run build` must succeed with zero errors
- `pnpm run typecheck` must pass
- Tests live in `tests/` directory (not colocated)
- Use MSW for API mocking (`tests/mocks/`)
- Target 90%+ coverage on new code
- Vitest config: jsdom environment, `@/` alias, setup file `tests/setup.ts`

## 8. State & API Contract

### Auth Flow

1. Protected route → middleware checks `auth-token` cookie → redirect to `/login` if missing
2. Discord OAuth → backend returns `AuthTokens` (access, refresh, expiresAt)
3. Zustand store (persisted to `localStorage` key `auth-storage`)
4. `ApiClient` auto-attaches Bearer token, auto-refreshes on 401

### Response Shapes

```typescript
interface ApiResponse<T> { data: T; message?: string; status: number; }
interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number; totalPages: number; }
interface ApiError { message: string; code: string; status: number; }
```

### Environment

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL (required) |
| `NEXT_PUBLIC_APP_URL` | Frontend URL (required) |
| `NODE_ENV` | development / test / production |
