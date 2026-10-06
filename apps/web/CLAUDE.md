# MCDI-Front — Claude Code Project Guide

@AGENTS.md

## 1. Project Overview & Tech Stack

**MCDI** (MicroClub Discord Interface) is a full-stack admin platform for managing MicroClub's Discord infrastructure. This repo (`MCDI-Front`) is the **frontend SPA** — a modern admin panel replacing a legacy EJS-based UI.

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| Language | TypeScript (strict mode) | ^5 |
| UI | Tailwind CSS v4 (CSS-based `@theme`) | ^4 |
| State (server) | TanStack React Query | ^5 |
| State (client) | Zustand (persist middleware) | ^5 |
| Components | Radix UI primitives | latest |
| Icons | Lucide React | ^1.8 |
| Validation | Zod v4 | ^4 |
| Testing | Vitest + React Testing Library + MSW | latest |
| Linting | ESLint 9 flat config + Prettier | latest |

**Backend**: NestJS API at `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/api`). See the full V2 specification in `../../docs/MCDI-V2-SPECIFICATION.md`.

## 2. Architecture & Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (DM Sans + JetBrains Mono fonts)
│   ├── page.tsx                  # Landing page
│   ├── providers.tsx             # Client-side providers (QueryProvider)
│   └── (dashboard)/              # Route group — all authenticated views
│       ├── layout.tsx            # Dashboard shell (sidebar + topbar)
│       └── page.tsx              # Dashboard home
├── features/                     # Feature-sliced modules
│   ├── auth/                     # Authentication (store + API)
│   │   ├── stores/auth.ts        # Zustand auth store (persist to localStorage)
│   │   └── api/index.ts          # Auth API barrel (re-exports from shared)
│   ├── channels/                 # Channel management
│   ├── members/                  # Member directory
│   ├── monitoring/               # System monitoring
│   ├── projects/                 # Project management
│   ├── roles/                    # Role & permission management
│   ├── servers/                  # Discord server management
│   ├── settings/                 # Application settings
│   ├── stats/                    # Analytics & statistics
│   ├── sync/                     # Discord sync operations
│   └── webhooks/                 # Webhook configuration
├── providers/                    # React context providers
│   ├── QueryProvider.tsx         # TanStack Query client setup
│   └── index.ts                  # Provider barrel exports
├── shared/                       # Cross-cutting concerns
│   ├── components/common/        # Shared UI components
│   │   ├── ErrorBoundary.tsx     # React error boundary
│   │   └── LoadingSkeleton.tsx   # Loading skeleton + card variant
│   ├── lib/
│   │   ├── api-client.ts         # HTTP client with token refresh
│   │   ├── env.ts                # Zod-validated env variables
│   │   └── utils.ts              # cn() utility (clsx + tailwind-merge)
│   ├── styles/globals.css        # Design system tokens (@theme block)
│   └── types/index.ts            # Shared TypeScript interfaces
└── proxy.ts                      # Auth guard (cookie-based redirect)
```

### Key Architectural Decisions

- **Feature-sliced design**: Each feature module is self-contained with its own stores, API, components, and types. Cross-feature imports go through `@/shared/`.
- **Path alias**: `@/` maps to `./src/` (configured in `tsconfig.json`).
- **No `tailwind.config.ts`**: Tailwind v4 uses CSS-based config via `@theme` in `globals.css`.
- **Dark-only UI**: No light mode, no theme toggle, no `dark:` prefixed classes. The design system is a Discord-inspired dark theme.
- **Deployment**: the web app is deployed on Vercel straight from this monorepo (Root Directory `apps/web`); there is no Docker image for it.

## 3. Code Style & Gotchas

### TypeScript Rules (Enforced by ESLint + tsconfig)

- `no-explicit-any`: **Error** — never use `any`, use `unknown` and narrow.
- `consistent-type-imports`: **Error** — always use `import type` for type-only imports.
- `no-unused-vars`: **Error** — prefix intentionally unused vars with `_`.
- `noUncheckedIndexedAccess`: **Enabled** — array/object index access returns `T | undefined`.
- `noImplicitOverride`: **Enabled** — class methods overriding parent must use `override` keyword.

### Code Conventions

- **File naming**: `kebab-case.tsx` for components, `camelCase.ts` for utilities.
- **Component exports**: Named exports only (no `export default` except Next.js pages/layouts).
- **Barrel files**: Each feature and shared module has `index.ts` for public API.
- **CSS classes**: Use `cn()` from `@/shared/lib/utils` for conditional class merging.
- **No comments in code** unless the "why" is non-obvious.

### Gotchas

1. **Next.js 16 breaking changes**: Read `node_modules/next/dist/docs/` before using any Next.js API.
2. **Zustand persist**: Auth store hydrates from `localStorage` key `auth-storage`. SSR-unsafe — only access in client components.
3. **API client singleton**: `apiClient` in `api-client.ts` is a module-level singleton. It reads auth state directly from Zustand's `getState()` — no React context needed.
4. **Token refresh race**: The `ApiClient` deduplicates concurrent refresh calls via `refreshPromise`. Never create a second `ApiClient` instance.
5. **Env validation**: `env.ts` throws at import time if required env vars are missing. This crashes the build intentionally.

## 4. UI & Design System

### V2 Design System — Discord-Inspired Dark Theme

**Brand Colors (Discord Blurple)**:
| Token | Value | Usage |
|---|---|---|
| `brand` | `#5865F2` | Primary buttons, links, focus rings |
| `brand-hover` | `#4752C4` | Hover states |
| `brand-active` | `#3C45A5` | Active/pressed states |
| `brand-light` | `#8B9CFC` | Light accent, badges |
| `brand-tint` | `rgba(88,101,242,0.15)` | Background highlights |

**Surface Colors (Layered Dark)**:
| Token | Value | Usage |
|---|---|---|
| `surface-base` | `#1E1F22` | Page background |
| `surface-raised` | `#2B2D31` | Cards, sidebar |
| `surface-main` | `#313338` | Main content area |
| `surface-hover` | `#35363C` | Hover backgrounds |
| `surface-active` | `#404249` | Active/selected items |
| `surface-elevated` | `#4E5058` | Tooltips, dropdowns |

**Text Hierarchy**:
| Token | Value | Usage |
|---|---|---|
| `text-primary` | `#F2F3F5` | Headings, important text |
| `text-normal` | `#DBDEE1` | Body text |
| `text-muted` | `#B5BAC1` | Secondary text |
| `text-subtle` | `#949BA4` | Tertiary text, timestamps |
| `text-faint` | `#6D6F78` | Disabled, placeholder |

**Semantic Colors**: `success` (#23A559), `error` (#DA373C), `warning` (#F0B232), `info` (#5865F2), `accent` (#EB459E)

**Typography**: DM Sans (body/headings) + JetBrains Mono (code/data). 4px spacing grid. Border radius: `sm` (4px), `md` (6px), `DEFAULT` (8px), `lg` (12px).

### Usage Rules

- Use Tailwind utility classes with design tokens: `bg-surface-base`, `text-text-muted`, `border-border`, etc.
- Never hardcode hex colors — always reference tokens.
- Never use `dark:` prefixed classes — the app is dark-only.
- Use `cn()` for conditional/merged classes.
- Icons: use `lucide-react` exclusively.

## 5. Workflow & Executable Commands

### Development

```bash
pnpm run dev              # Start dev server (localhost:3002)
pnpm run build            # Production build
pnpm run start            # Start production server
```

### Code Quality

```bash
pnpm run lint             # ESLint check
pnpm run lint:fix         # ESLint auto-fix
pnpm run format           # Prettier write
pnpm run format:check     # Prettier check
pnpm run typecheck        # TypeScript type check (tsc --noEmit)
```

### Testing

```bash
pnpm run test             # Vitest (watch mode)
pnpm run test:coverage    # Vitest with coverage report
pnpm run test:ui          # Vitest UI
```

### Pre-commit Checklist

Before every commit, ensure:
1. `pnpm run typecheck` passes
2. `pnpm run lint` passes
3. `pnpm run format:check` passes
4. `pnpm run build` passes

## 6. Agent Brief & Persona

You are a **senior frontend engineer** working on a Discord-inspired admin panel. Your priorities:

1. **Design system compliance**: Every UI element must use the V2 design tokens. No hardcoded colors, no light mode, no `dark:` classes.
2. **Type safety**: Leverage TypeScript's strict mode. No `any`, no type assertions unless absolutely necessary.
3. **Feature isolation**: Keep feature modules independent. Shared logic goes in `@/shared/`.
4. **Performance**: Use React Query for server state, Zustand for client state. No prop drilling. Lazy load feature routes.
5. **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation, focus management.

### When Building New Features

1. Create the feature directory under `src/features/<name>/`
2. Add types in `types/`, API hooks in `api/`, stores in `stores/`, components in `components/`
3. Export public API through `index.ts` barrel file
4. Add the route page under `src/app/(dashboard)/<name>/page.tsx`
5. Use existing shared components and design tokens

### When Modifying Existing Code

- Check the feature's barrel file to understand its public API
- Run `pnpm run typecheck` after changes
- Run `pnpm run lint` to catch style issues
- Run `pnpm run format` to auto-fix formatting

## 7. Build & Test Requirements

### Build

- `pnpm run build` must succeed with zero errors and zero TypeScript errors.
- Env vars are validated at build time by `env.ts`.

### Tests

- **Framework**: Vitest with jsdom environment.
- **Setup**: `tests/setup.ts` runs before all tests.
- **Location**: `tests/` directory (not colocated with source).
- **Alias**: `@/` resolves to `./src/` in test config.
- **Mocking**: Use MSW for API mocking (setup in `tests/mocks/`).
- **Coverage**: Target 90%+ on new code. Reporter: text, json, html.

### Test Patterns

```typescript
// Component test
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('expected')).toBeInTheDocument();
  });
});
```

## 8. State & API Contract

### Auth Flow

1. User visits protected route → proxy checks `auth-token` cookie
2. If no cookie → redirect to `/login?redirect=<path>`
3. Login via Discord OAuth → backend returns `AuthTokens` (`accessToken`, `refreshToken`, `expiresAt`)
4. Tokens stored in Zustand (persisted to `localStorage` under `auth-storage`)
5. `ApiClient` attaches `Authorization: Bearer <accessToken>` to all requests
6. On 401 → auto-refresh via `POST /auth/refresh` with `refreshToken`

### API Response Contract

```typescript
// Success
interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

// Paginated
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Error
interface ApiError {
  message: string;
  code: string;
  status: number;
}
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | — | Backend API base URL |
| `NEXT_PUBLIC_APP_URL` | Yes | — | Frontend app URL |
| `NODE_ENV` | Yes | — | `development` / `test` / `production` |

### Feature Routes

| Feature | Route | Status |
|---|---|---|
| Auth | `/login`, `/callback` | Scaffold ready |
| Servers | `/dashboard/servers` | Barrel only |
| Members | `/dashboard/members` | Barrel only |
| Projects | `/dashboard/projects` | Barrel only |
| Roles | `/dashboard/roles` | Barrel only |
| Channels | `/dashboard/channels` | Barrel only |
| Webhooks | `/dashboard/webhooks` | Barrel only |
| Sync | `/dashboard/sync` | Barrel only |
| Stats | `/dashboard/stats` | Barrel only |
| Monitoring | `/dashboard/monitoring` | Barrel only |
| Settings | `/dashboard/settings` | Barrel only |
