# MCID-Front

> The admin panel for **Micro Club Identity**, built with [mcoli-ui](https://mcoli-ui.microclub.info/docs/introduction), the Micro Club design system, in light and dark mode. It replaces the legacy EJS admin panel.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?logo=reactquery)](https://tanstack.com/query)

---

## Table of contents

- [Overview](#overview)
- [Getting started](#getting-started)
- [Architecture](#architecture)
- [Design system](#design-system)
- [Building pages](#building-pages)
- [State management](#state-management)
- [API layer](#api-layer)
- [Testing](#testing)
- [AI workflow & ecosystem](#ai-workflow--ecosystem)
- [Commands reference](#commands-reference)
- [Contributing](#contributing)

---

## Overview

MCID (Micro Club Identity) is a full-stack platform that serves as the identity and management layer for all Micro Club applications. The backend is a NestJS API handling Discord OAuth, member sync, role management, and project lifecycle. This repo is the **frontend** — a Next.js 16 SPA that provides admins with a professional dashboard to manage servers, members, roles, projects, channels, webhooks, sync operations, and analytics.

### Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.2 |
| Language | TypeScript (strict mode) | 5.x |
| Styling | Tailwind CSS (CSS-based `@theme`) | 4.x |
| Server state | TanStack React Query | 5.x |
| Client state | Zustand (persist middleware) | 5.x |
| UI components | mcoli-ui (shadcn registry on Base UI) | latest |
| Icons | Lucide React | 1.8.x |
| Validation | Zod | 4.x |
| Testing | Vitest + React Testing Library + MSW | latest |
| Linting | ESLint 9 (flat config) + Prettier | latest |

### Feature modules

| Module | Route | Description |
|---|---|---|
| Auth | `/login`, `/callback` | Discord OAuth login flow |
| Servers | `/dashboard/servers` | Discord server management |
| Members | `/dashboard/members` | Member directory and profiles |
| Projects | `/dashboard/projects` | Project lifecycle and API keys |
| Roles | `/dashboard/roles` | Role-permission assignment |
| Channels | `/dashboard/channels` | Channel messaging APIs |
| Webhooks | `/dashboard/webhooks` | Webhook configuration |
| Sync | `/dashboard/sync` | Discord member sync operations |
| Stats | `/dashboard/stats` | Analytics and usage metrics |
| Monitoring | `/dashboard/monitoring` | System health monitoring |
| Settings | `/dashboard/settings` | Application configuration |

---

## Getting started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10 (the repo is a pnpm + Turborepo workspace)
- A running instance of the [MCID Backend](https://github.com/MicroClub-USTHB/MCID) (NestJS API)

### Installation

```bash
# Clone the monorepo and install every workspace from the repository root
git clone https://github.com/MicroClub-USTHB/MCID.git
cd MCID
pnpm install

# Everything below runs from apps/web
cd apps/web

# Copy the environment file
cp .env.example .env
# Or create .env manually:
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
# NEXT_PUBLIC_APP_URL=http://localhost:3002
# NODE_ENV=development

# Start the dev server
pnpm run dev
```

Open [http://localhost:3002](http://localhost:3002) to see the app.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL (e.g., `http://localhost:3000/api`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend app URL (e.g., `http://localhost:3002`) |
| `NODE_ENV` | Yes | `development`, `test`, or `production` |

Environment variables are validated at build time using Zod (`src/shared/lib/env.ts`). Missing or invalid vars will crash the build intentionally.

### Available scripts

```bash
pnpm run dev              # Start dev server (localhost:3002)
pnpm run build            # Production build
pnpm run start            # Start production server

pnpm run lint             # ESLint check
pnpm run lint:fix         # ESLint auto-fix
pnpm run format           # Prettier write
pnpm run format:check     # Prettier check (CI-safe)
pnpm run typecheck        # TypeScript type check (tsc --noEmit)

pnpm run test             # Vitest (watch mode)
pnpm run test:coverage    # Vitest with coverage report
pnpm run test:ui          # Vitest browser UI
```

---

## Architecture

### Directory structure

```
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (fonts, providers)
│   ├── page.tsx                      # Landing page
│   ├── providers.tsx                 # Client-side provider tree
│   └── (dashboard)/                  # Route group (auth-guarded)
│       ├── layout.tsx                # Dashboard shell (sidebar + topbar)
│       ├── page.tsx                  # Dashboard home
│       └── <feature>/page.tsx        # Feature pages
│
├── features/                         # Feature-sliced modules
│   └── <feature>/
│       ├── api/                      # React Query hooks + API calls
│       │   └── index.ts
│       ├── components/               # Feature-specific components
│       │   └── <Component>.tsx
│       ├── stores/                   # Zustand stores (if needed)
│       │   └── <store>.ts
│       ├── types/                    # Feature-specific types
│       │   └── index.ts
│       └── index.ts                  # Public barrel export
│
├── providers/                        # React context providers
│   ├── QueryProvider.tsx             # TanStack Query client setup
│   └── index.ts
│
├── shared/                           # Cross-cutting concerns
│   ├── components/
│   │   └── common/                   # Shared UI components
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingSkeleton.tsx
│   │       └── index.ts
│   ├── lib/
│   │   ├── api-client.ts            # HTTP client with token refresh
│   │   ├── env.ts                   # Zod-validated env variables
│   │   └── utils.ts                 # cn() utility (clsx + tailwind-merge)
│   ├── styles/
│   │   └── globals.css              # mcoli-ui theme tokens (light and dark)
│   └── types/
│       └── index.ts                 # Shared TypeScript interfaces
│
└── proxy.ts                          # Auth guard (cookie-based redirect)
```

### Key principles

1. **Feature-sliced design** — each feature module (`src/features/<name>/`) is self-contained with its own types, API hooks, stores, and components. Cross-feature code lives in `src/shared/`.

2. **Path alias** — `@/` maps to `./src/`. Use it everywhere: `import { cn } from '@/shared/lib/utils'`.

3. **Barrel exports** — every module has an `index.ts` that re-exports the public API. Import from the barrel, not from internal files.

4. **Server components by default** — only add `'use client'` when a component uses hooks, event handlers, or browser APIs.

5. **Vercel deployment** — the app is deployed on Vercel from this monorepo (Root Directory `apps/web`); there is no Docker image for it.

### Import rules

```typescript
// Feature imports its own internals directly
import { MemberCard } from './components/MemberCard';

// Feature imports from shared
import { cn } from '@/shared/lib/utils';
import { LoadingSkeleton } from '@/shared/components/common';
import type { ApiResponse } from '@/shared/types';

// Feature imports from another feature's PUBLIC API only
import { useAuthStore } from '@/features/auth';
```

---

## Design system

MCID uses [mcoli-ui](https://mcoli-ui.microclub.info/docs/introduction), the Micro Club design system, with its `primary` theme: a deep blue primary with purple accents, DM Sans for text and Plus Jakarta Sans for headings. mcoli-ui is a shadcn registry built on Base UI, so its components are copied into `src/shared/components/ui/mc-*.tsx` and the project owns their source.

### Theme and modes

`npx mcoli-ui@latest init primary` writes the theme into `src/shared/styles/globals.css`: a light palette under `:root`, a dark palette under `.dark`, the Tailwind colour mapping in `@theme inline`, and the `header-*` / `paragraph-*` type utilities. Re-run the command to update the theme rather than editing those blocks.

The panel follows the system's light or dark setting. The theme button in the top bar (and on the landing and docs pages) switches between system, light and dark; `next-themes` stores the choice and sets the `dark` class on `<html>`.

### Tokens

| Group | Tokens |
|---|---|
| Base | `background`, `foreground` |
| Brand and actions | `primary`, `secondary`, `accent`, each with a `-foreground` pair |
| Surfaces | `card`, `popover`, `muted`, `surface`, each with a `-foreground` pair |
| State | `success`, `warning`, `error`, `destructive`, `info`, each with a `-foreground` pair |
| Form and focus | `border`, `input`, `ring` |
| Sidebar | `sidebar`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring` and their `-foreground` pairs |
| Charts | `chart-1` to `chart-5` |

### Typography

- **Headings**: `header-xl` to `header-xs` (Plus Jakarta Sans), with `font-bold`
- **Text**: `paragraph-xl` to `paragraph-xs` (DM Sans)
- **Code, ids and data**: `font-mono` (JetBrains Mono)

### Components

| Need | Component |
|---|---|
| Buttons | `McButton` (`primary`, `secondary`, `tertiary`, `link`, `destructive`); `buttonVariants` on a `<Link>` for links that look like buttons |
| Forms | `McInput`, `McTextarea`, `McSelect`, `McCombobox`, `McCheckbox`, `McRadioGroup`, `McSwitch` |
| Layout | `McCard`, `McTabs`, `McSeparator`, `McSidebar`, `McBreadcrumb`, `McScrollArea` |
| Overlays | `McDialog`, `McAlertDialog`, `McDrawer`, `McPopover`, `McTooltip`, `McDropdownMenu` |
| Feedback | `McBadge`, `McAlert`, `McProgress`, `McSkeleton`, toasts through `showToast()` |
| Data | `DataTable` (TanStack Table v9 on `mc-data-table`), `Pagination`, `StatCard`, `EmptyState` |

Add a component with `npx mcoli-ui@latest add <name>`; `npx mcoli-ui@latest list` shows the catalogue.

### Recipes

**Buttons and links:**
```tsx
<McButton onClick={save}>Save</McButton>
<McButton variant="secondary" icon="leading" iconDefinition={<Plus aria-hidden="true" />}>
  Add server
</McButton>
<Link href="/dashboard/servers" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
  Open servers
</Link>
```

**Card:**
```tsx
<McCard>
  <McCardHeader title="Members" description="Everyone synced from Discord." />
  <McCardContent>…</McCardContent>
</McCard>
```

**Field:**
```tsx
<McInput label="Project name" error={errors.name} {...register('name')} />
```

**Select:**
```tsx
<McSelect items={items} value={value} onValueChange={(next) => next && setValue(next)}>
  <McSelectTrigger aria-label="Server type" className="w-full">
    <McSelectValue placeholder="Pick a type" />
  </McSelectTrigger>
  <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
    {items.map((item) => (
      <McSelectItem key={item.value} value={item.value}>
        {item.label}
      </McSelectItem>
    ))}
  </McSelectContent>
</McSelect>
```

### Design system rules

1. **Never hardcode colours**: use the token classes.
2. **Build from `Mc*` components** before writing your own markup.
3. **Both modes count**: check light and dark. Tokens switch on their own, so components do not need `dark:` classes for colour.
4. **Base UI uses `render`, not `asChild`**, and a link that looks like a button keeps its link role through `buttonVariants`.
5. **Use `cn()` for conditional classes**, imported from `@/shared/lib/utils`.
6. **Icons from `lucide-react` only**, with `aria-hidden="true"` on decorative ones.

---

## Building pages

### Step-by-step: adding a new feature page

Here's the complete process for adding a new feature (example: Members page).

#### 1. Create the feature module

```
src/features/members/
├── api/
│   ├── useMembers.ts         # React Query hooks
│   └── index.ts              # API barrel
├── components/
│   ├── MemberCard.tsx
│   ├── MemberTable.tsx
│   └── index.ts              # Components barrel
├── types/
│   └── index.ts              # Feature types
└── index.ts                  # Public barrel
```

#### 2. Define types

```typescript
// src/features/members/types/index.ts
export interface Member {
  id: string;
  discordId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  roles: string[];
  joinedAt: string;
}
```

#### 3. Create API hooks

```typescript
// src/features/members/api/useMembers.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api-client';
import type { Member } from '../types';
import type { PaginatedResponse } from '@/shared/types';

export const memberKeys = {
  all: ['members'] as const,
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...memberKeys.lists(), filters] as const,
  details: () => [...memberKeys.all, 'detail'] as const,
  detail: (id: string) => [...memberKeys.details(), id] as const,
};

export function useMembers(filters?: { page?: number; search?: string }) {
  return useQuery({
    queryKey: memberKeys.list(filters ?? {}),
    queryFn: () =>
      apiClient.get<PaginatedResponse<Member>>('/members'),
  });
}
```

#### 4. Build components

```tsx
// src/features/members/components/MemberCard.tsx
'use client';

import { User } from 'lucide-react';
import { McAvatar, McAvatarFallback, McAvatarImage } from '@/shared/components/ui/mc-avatar';
import { McCard } from '@/shared/components/ui/mc-card';
import { cn } from '@/shared/lib/utils';
import type { Member } from '../types';

interface MemberCardProps {
  member: Member;
  className?: string;
}

export function MemberCard({ member, className }: MemberCardProps) {
  return (
    <McCard direction="row" className={cn('items-center', className)}>
      <McAvatar size="md">
        {member.avatar && <McAvatarImage src={member.avatar} alt="" />}
        <McAvatarFallback>
          <User className="size-5" aria-hidden="true" />
        </McAvatarFallback>
      </McAvatar>
      <div>
        <p className="paragraph-sm font-medium text-foreground">{member.displayName}</p>
        <p className="paragraph-xs text-muted-foreground">@{member.username}</p>
      </div>
    </McCard>
  );
}
```

#### 5. Create the route page

```tsx
// src/app/(dashboard)/members/page.tsx
import { MemberTable } from '@/features/members/components';

export default function MembersPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="header-xs font-bold text-foreground">Members</h1>
      </div>
      <MemberTable />
    </div>
  );
}
```

#### 6. Export from barrel

```typescript
// src/features/members/index.ts
export { useMembers, memberKeys } from './api';
export { MemberCard, MemberTable } from './components';
export type { Member } from './types';
```

---

## State management

### Decision framework

| Data type | Tool | Example |
|---|---|---|
| Server data | **React Query** | Member list, server details, project configs |
| Auth session | **Zustand** (persisted) | User, tokens, isAuthenticated |
| UI preferences | **Zustand** | Sidebar collapsed, active tab |
| Form state | **useState** | Input values, validation errors |
| URL state | **useSearchParams** | Filters, pagination, active tab |
| Derived values | Computed inline | Filtered lists, counts, booleans |

### Rules

- **React Query for all API data** — it gives you caching, background refetch, loading/error states, and deduplication for free.
- **Zustand for client-only global state** — auth tokens, UI preferences. Never for server data.
- **useState for local/transient state** — if only one component uses it, keep it local.
- **Never duplicate state** — don't store the same data in both React Query and Zustand.
- **Never sync with useEffect** — if you're syncing state between stores with `useEffect`, the architecture is wrong.

### Query key convention

```typescript
const memberKeys = {
  all:     ['members'] as const,
  lists:   () => [...memberKeys.all, 'list'] as const,
  list:    (filters) => [...memberKeys.lists(), filters] as const,
  details: () => [...memberKeys.all, 'detail'] as const,
  detail:  (id) => [...memberKeys.details(), id] as const,
};
```

---

## API layer

### HTTP client

All API calls go through `apiClient` — a singleton instance of `ApiClient` defined in `src/shared/lib/api-client.ts`. Never use raw `fetch()` in the application.

```typescript
import { apiClient } from '@/shared/lib/api-client';

// GET
const members = await apiClient.get<Member[]>('/members');

// POST
const newProject = await apiClient.post<Project>('/projects', { name: 'My Project' });

// PUT / PATCH / DELETE
await apiClient.put<Project>('/projects/123', updatedData);
await apiClient.patch<Project>('/projects/123', partialData);
await apiClient.delete('/projects/123');
```

### Auth flow

1. User visits a protected route → proxy checks `auth-token` cookie
2. No cookie → redirect to `/login?redirect=<original-path>`
3. Discord OAuth completes → backend returns `AuthTokens` (accessToken, refreshToken, expiresAt)
4. Tokens stored in Zustand (persisted to `localStorage` key `auth-storage`)
5. `ApiClient` auto-attaches `Authorization: Bearer <accessToken>` to every request
6. On 401 → auto-refreshes via `POST /auth/refresh` (deduplicated for concurrent requests)

### Response shapes

```typescript
// Success response
interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

// Paginated response
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Error response
interface ApiError {
  message: string;
  code: string;
  status: number;
}
```

---

## Testing

### Setup

- **Framework**: Vitest with jsdom environment
- **Libraries**: React Testing Library + MSW for API mocking
- **Location**: `tests/` directory (not colocated with source)
- **Coverage target**: 90%+ on new code

### Writing tests

```typescript
// tests/features/members/MemberCard.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemberCard } from '@/features/members/components/MemberCard';

const mockMember = {
  id: '1',
  discordId: '123456789',
  username: 'john',
  displayName: 'John Doe',
  avatar: null,
  roles: ['admin'],
  joinedAt: '2024-01-01T00:00:00Z',
};

describe('MemberCard', () => {
  it('renders member display name', () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('renders fallback icon when no avatar', () => {
    render(<MemberCard member={mockMember} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
```

### Running tests

```bash
pnpm run test              # Watch mode
pnpm run test:coverage     # Full coverage report
pnpm run test:ui           # Browser-based test UI
```

---

## AI workflow & ecosystem

This project includes a comprehensive AI-assisted development ecosystem. Whether you use Claude Code, OpenCode, Cursor, or any other AI coding agent, the configuration files provide consistent guidance.

### Configuration files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Claude Code-specific project guide (references `AGENTS.md`) |
| `AGENTS.md` | Universal agent instructions (works with any AI tool) |

Both files contain the same 8 sections: project overview, architecture, code style, design system, workflow, agent persona, build requirements, and API contracts.

### Agents (`.claude/agents/` and `.opencode/agents/`)

Specialized AI personas that audit your code from different angles:

| Agent | What it checks |
|---|---|
| **ui-ux-guardian** | mcoli-ui component and token compliance in light and dark mode, CLS prevention, hover/focus states |
| **state-architect** | Correct state tool selection (React Query vs Zustand vs useState) |
| **accessibility-auditor** | WCAG 2.1 AA compliance, ARIA labels, keyboard navigation, focus management |
| **security-auditor** | XSS prevention, auth token handling, input validation, dependency security |

### Commands (`.claude/commands/` and `.opencode/commands/`)

Slash commands that automate common workflows:

| Command | What it does |
|---|---|
| `/work-issue <number>` | **Full pipeline**: fetch issue → plan → build → audit → verify → ship |
| `/new-ui <Name>` | Scaffold a component with `.tsx` + `.spec.tsx` + `index.ts` |
| `/commit` | Run quality checks, stage changes, create a conventional commit |
| `/draft-pr` | Push branch, create a structured PR with design system checklist |
| `/audit-bundle` | Analyze bundle for heavy imports, missing code-splitting |
| `/preview-route <path>` | Verify loading, error, and empty states on a route |

### Skills (`.claude/skills/` and `.opencode/skills/`)

Reference guides that agents consult during implementation:

| Skill | Content |
|---|---|
| **tailwind-design-system** | mcoli-ui theme tokens, component catalogue and usage rules |
| **tailwind-css-patterns** | Responsive layouts, flexbox/grid, mobile-first patterns (adapted for MCID tokens) |
| **vercel-react-best-practices** | 64 performance rules: waterfalls, bundle size, re-renders, SSR |
| **tanstack-query-best-practices** | 21 rules: query keys, caching, mutations, prefetching, SSR, offline |
| **tanstack-integration-best-practices** | 4 rules: Router + Query integration, SSR hydration |

### Recommended workflow

The `/work-issue` command automates this entire pipeline, but here's what happens under the hood:

```
┌─────────────────────────────────────────────────────┐
│  Phase 0: Fetch                                     │
│  gh issue view <N> → read title, checklist, spec    │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 1: Plan                                      │
│  Create branch → break into tasks → map skills      │
│  → present plan → wait for confirmation             │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 2: Build (loop)                              │
│  For each task:                                     │
│    Reference skill → scaffold → implement → commit  │
│    ↻ repeat until all tasks done                    │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 3: Quality gates                             │
│  Run all 4 agents → fix findings → commit fixes     │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 4: Verify                                    │
│  typecheck + lint + format + build + visual check   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase 5: Ship                                      │
│  Push → create PR (Closes #N) → self-review         │
└─────────────────────────────────────────────────────┘
```

### Quick start with AI

```bash
# Start working on an issue (full pipeline)
/work-issue 15

# Or do it manually:

# 1. Create a branch
git checkout -b benabdou1001/my-feature

# 2. Scaffold a component
/new-ui MemberCard --feature members

# 3. Build, then commit
/commit

# 4. When done, ship it
/draft-pr
```

---

## Commands reference

### Development

| Command | Description |
|---|---|
| `pnpm run dev` | Start Next.js dev server at `localhost:3002` |
| `pnpm run build` | Production build |
| `pnpm run start` | Start production server |

### Code quality

| Command | Description |
|---|---|
| `pnpm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `pnpm run lint` | ESLint check |
| `pnpm run lint:fix` | ESLint auto-fix |
| `pnpm run format` | Prettier write |
| `pnpm run format:check` | Prettier check (fails in CI if formatting is off) |

### Testing

| Command | Description |
|---|---|
| `pnpm run test` | Vitest in watch mode |
| `pnpm run test:coverage` | Generate coverage report (text + json + html) |
| `pnpm run test:ui` | Vitest browser UI |

### Pre-commit checklist

Before every commit, ensure all four pass:

```bash
pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run build
```

---

## Contributing

### Branch naming

```
benabdou1001/<type>-<short-description>
```

Examples:
- `benabdou1001/add-member-directory-page`
- `benabdou1001/fix-auth-redirect-loop`
- `benabdou1001/migrate-to-v2-design-system`

### Commit convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

<optional body>

Refs #<issue-number>
```

**Types**: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`

**Scopes**: `auth`, `dashboard`, `ui`, `api`, `config`, `deps`

### Code style

- **No `any`** — use `unknown` and narrow. ESLint will error.
- **Type imports** — always `import type { Foo }` for type-only imports.
- **No unused vars** — prefix intentionally unused vars with `_`.
- **No default exports** — except Next.js pages and layouts.
- **No comments** — unless explaining a non-obvious "why".
- **`cn()` for classes** — always merge classes with `cn()` from `@/shared/lib/utils`.
- **No hardcoded colors** — use design system tokens.
- **No `dark:` classes** — tokens switch for light and dark mode on their own.

### PR checklist

- [ ] All colours use mcoli-ui theme tokens and screens use the Mc* components
- [ ] No hardcoded hex values
- [ ] No `dark:` prefixed classes
- [ ] Typography uses DM Sans / JetBrains Mono
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm run build` passes
- [ ] Tests written for new code
- [ ] Issue referenced (`Closes #N` or `Refs #N`)

---

## License

This project is maintained by [Micro Club USTHB](https://github.com/MicroClub-USTHB).
