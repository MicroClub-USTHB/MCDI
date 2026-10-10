# MCDI V2 — Full Specification Document
## MicroClub Discord Interface — Version 2

> **Historical design record.** This file is the full V2 specification, written before the work it describes. Parts of it were built differently or not at all. It is kept for the reasoning behind past decisions and is no longer updated. For how MCDI behaves today, read the developer docs: at `/docs` in the admin panel app, or in `apps/web/src/content/docs`. See [`docs/README.md`](README.md).


> **Status**: Draft — Ready for GitHub Issue Creation
> **Focus**: Front-End Application + Backend Extensions (Discord Operations, Webhooks, Analytics)
> **Target Audience**: Development Team (Frontend + Backend)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Frontend Specification](#3-frontend-specification)
4. [Backend Specification](#4-backend-specification)
5. [Database Migrations](#5-database-migrations)
6. [Security Model](#6-security-model)
7. [Testing Strategy](#7-testing-strategy)
8. [Dependencies Graph](#8-dependencies-graph)
9. [Migration Plan (EJS → New Frontend)](#9-migration-plan)
10. [Environment Variables](#10-environment-variables)
11. [Error Response Standard](#11-error-response-standard)
12. [Issue Templates](#12-issue-templates)

---

## 1. Executive Summary

### 1.1 Current State

MCDI is a production-ready NestJS backend API that serves as the Discord identity layer for all MicroClub applications. It currently provides:
- Discord OAuth authentication for projects and admins
- Member synchronization via Discord.js bot
- Role-based permission system with inheritance
- Project management with API key lifecycle
- Multi-server support with access control
- Sync management with real-time gateway events
- Basic EJS-based admin panel (login + project creation form)

### 1.2 V2 Goals

V2 transforms MCDI from a **backend-only API** into a **full-stack platform**:

| Area | Goal |
|---|---|
| **Frontend** | Build a professional, responsive admin web application replacing the EJS panel |
| **Discord Operations** | Expose channel messaging and webhook management APIs to authorized projects |
| **Analytics** | Add member statistics and system usage monitoring |
| **Role Management** | Add admin APIs for direct role-permission editing |
| **Audit** | Expand logging to cover auth events, admin actions, and webhook executions |
| **Sessions** | Harden session lifecycle with refresh tokens and introspection |

### 1.3 Success Metrics

- Admin panel fully replaces EJS templates with modern SPA
- All V2 features have Swagger documentation
- 90%+ test coverage on new code
- API response times remain under 200ms for existing endpoints
- Zero breaking changes to MVP API contracts

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                      │
│                  (Next.js / React + Vite)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Auth    │ │ Servers  │ │ Projects │ │   Members    │   │
│  │  Pages   │ │  Pages   │ │  Pages   │ │    Pages     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Roles   │ │  Sync    │ │ Webhooks │ │  Monitoring  │   │
│  │  Pages   │ │  Pages   │ │  Pages   │ │    Pages     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / REST API
┌──────────────────────────▼──────────────────────────────────┐
│                   MCDI Backend (NestJS)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │   Auth   │ │ Members  │ │Permis-   │ │   Servers    │   │
│  │  Module  │ │  Module  │ │ sions    │ │   Module     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Projects │ │  Sync    │ │ Channels │ │  Webhooks    │   │
│  │  Module  │ │  Module  │ │ (V2 New) │ │  (V2 New)    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Admin   │ │  Stats   │ │  Audit   │ │  Discord.js  │   │
│  │ Members  │ │ (V2 New) │ │(V2 New)  │ │   Service    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└──────────┬──────────────────────┬───────────────────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────┐
    │ PostgreSQL  │        │    Redis    │
    │  (Primary)  │        │   (Cache)   │
    └─────────────┘        └─────────────┘
           │
    ┌──────▼──────┐
    │  Discord    │
    │  API + Bot  │
    └─────────────┘
```

### 2.2 Frontend Architecture (Feature-Based)

The frontend uses **feature-based architecture** — each feature is a self-contained module with its own components, hooks, types, API layer, and utilities. Shared code lives in `@/shared`.

```
src/
├── app/                              # Next.js App Router (routing layer only)
│   ├── (auth)/
│   │   ├── login/
│   │   └── callback/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── servers/
│   │   ├── projects/
│   │   ├── members/
│   │   ├── roles/
│   │   ├── sync/
│   │   ├── channels/
│   │   ├── webhooks/
│   │   ├── monitoring/
│   │   └── settings/
│   └── layout.tsx
├── features/                         # Feature modules (self-contained)
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   ├── stores/
│   │   └── index.ts
│   ├── servers/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── projects/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── members/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── stats/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.ts
│   ├── roles/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── sync/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── channels/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── webhooks/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   ├── monitoring/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   └── settings/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       ├── types/
│       └── index.ts
├── shared/                           # Shared across features
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── common/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
├── providers/
│   └── index.ts
└── middleware.ts
```

### 2.3 Feature Module Contract

Every feature module follows this contract:

| File/Directory | Purpose |
|---|---|
| `index.ts` | Public API — only exports meant for external use |
| `components/` | React components scoped to this feature |
| `hooks/` | Custom hooks (data fetching with TanStack Query, business logic) |
| `api/` | API functions + TanStack Query key factories |
| `types/` | TypeScript types/interfaces for this feature |
| `stores/` | Feature-specific state (Zustand stores, if needed) |
| `utils/` | Feature-specific utilities (optional) |

**Import rules**:
- Features can import from `@/shared` but **never from other features**
- The `app/` layer only re-exports from features — no business logic
- Cross-feature communication happens through shared types or the API layer

### 2.4 Next.js 15 Patterns

| Pattern | Approach |
|---|---|
| Data fetching | TanStack Query in client components — **no server-side data fetching** for API data |
| Route segments | `app/(dashboard)/feature/page.tsx` re-exports from `features/feature/` |
| Auth guard | `middleware.ts` checks session cookie, redirects to `/login` |
| Server actions | Not used — all mutations go through TanStack Query + REST API |
| Client components | All feature pages are `"use client"` since they rely on TanStack Query |
| Layouts | `app/(dashboard)/layout.tsx` wraps dashboard shell (sidebar + top bar) |
| Loading states | `loading.tsx` files show skeletons per route segment |
| Error states | `error.tsx` files with error boundary per route segment |

---

## 3. Frontend Specification

### FE-01: Front-End Project Setup

**User Story**:
> As a frontend developer, I want a properly configured project scaffold, so I can start building features immediately without setup friction.

**Key Capabilities**:
- Next.js 15 with App Router
- TypeScript strict mode
- TailwindCSS with MicroClub design tokens
- ESLint + Prettier configuration
- TanStack Query for all data fetching
- Environment variable validation (Zod)
- CI/CD pipeline for frontend

**Component Breakdown** (all under `features/auth/`):
| Component | File | Props |
|---|---|---|
| `LoginPage` | `components/LoginPage.tsx` | — |
| `DiscordLoginButton` | `components/DiscordLoginButton.tsx` | size, variant |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | children, fallback |
| `AuthCallbackHandler` | `components/AuthCallbackHandler.tsx` | — |

**Hooks** (`features/auth/hooks/`):
| Hook | File | Returns |
|---|---|---|
| `useSession` | `useSession.ts` | session, isAuthenticated, isLoading |
| `useLogin` | `useLogin.ts` | login mutation |
| `useLogout` | `useLogout.ts` | logout mutation |

**API Layer** (`features/auth/api/`):
| File | Purpose |
|---|---|
| `auth-api.ts` | API functions (login, logout, getMe) |
| `auth-keys.ts` | TanStack Query key factory |

**Shared components used** (from `@/shared/`):
| Component | File |
|---|---|
| `ApiClient` | `lib/api-client.ts` |
| `QueryProvider` | `providers/QueryProvider.tsx` |
| `ThemeProvider` | `providers/ThemeProvider.tsx` |
| `ErrorBoundary` | `components/common/ErrorBoundary.tsx` |
| `LoadingSkeleton` | `components/common/LoadingSkeleton.tsx` |

**UI States**:
- Loading skeleton on initial app load
- Error boundary for crashed components
- Empty state illustrations

**Acceptance Criteria**:
- [ ] Project builds and runs locally with `npm run dev`
- [ ] TypeScript strict mode enabled, zero `any` types in core files
- [ ] TailwindCSS configured with MCDI design tokens (Discord-inspired dark theme — brand, surface, text, border, semantic colors)
- [ ] API client configured with auth interceptors (auto-attach Bearer token)
- [ ] ESLint passes with zero warnings
- [ ] Environment variables validated at startup via Zod schema
- [ ] Dockerfile for frontend container

**Testing Requirements**:
- [ ] Unit test for ApiClient interceptors
- [ ] Integration test for auth flow (mocked)

**Dependencies**: None (foundation issue)

---

### FE-02: Authentication System UI

**User Story**:
> As a club admin, I want to log in with my Discord account and stay authenticated, so I can access the admin panel securely without re-authenticating on every visit.

**Key Capabilities**:
- Admin login page with Discord OAuth button
- Session management (token storage in httpOnly cookie or localStorage)
- Protected route wrapper/guard
- Login state persistence across refreshes
- Logout functionality with session invalidation
- Auto-redirect after successful login

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `LoginPage` | Main login screen | — |
| `DiscordLoginButton` | OAuth trigger button | size, variant |
| `ProtectedRoute` | Route guard wrapper | children, fallback |
| `SessionProvider` | Session context provider | children |
| `AuthCallbackHandler` | Processes OAuth callback | — |

**UI States**:
| State | Display |
|---|---|
| Initial | Discord login button centered on page with MC logo |
| Loading | Spinner + "Connecting to Discord..." text |
| Error | Error message + retry button |
| Authenticated | Redirect to dashboard |
| Session expired | Toast notification + redirect to login |

**API Calls**:
```
GET  /api/auth/admin/discord          → Redirect to Discord OAuth
GET  /api/auth/admin/discord/callback → Process callback, set session
GET  /api/auth/admin/me               → Get current admin profile
POST /api/auth/logout                 → Invalidate session
```

**Acceptance Criteria**:
- [ ] Click "Login with Discord" redirects to Discord OAuth
- [ ] After callback, user is redirected to `/dashboard`
- [ ] Protected routes redirect to `/login` if unauthenticated
- [ ] Session persists across page refreshes (token stored securely)
- [ ] Logout clears session and redirects to login
- [ ] Expired session shows toast and redirects to login
- [ ] Admin without required Discord role sees "Access Denied" page

**Testing Requirements**:
- [ ] Unit test for ProtectedRoute component
- [ ] Unit test for SessionProvider
- [ ] E2E test for full login flow (Playwright/Cypress)

**Dependencies**: FE-01

---

### FE-03: Admin Dashboard Layout

**User Story**:
> As an admin, I want a consistent navigation layout across all pages, so I can easily move between different sections of the admin panel.

**Key Capabilities**:
- Responsive sidebar navigation with icons
- Top bar with user info, notifications, logout
- Dashboard home with quick stats cards
- Breadcrumb navigation
- Mobile hamburger menu

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `DashboardLayout` | Shell wrapper | children |
| `Sidebar` | Navigation menu | collapsed, items |
| `SidebarItem` | Nav link | icon, label, href, active |
| `TopBar` | Header bar | user, onLogout, onToggleSidebar |
| `Breadcrumb` | Path navigation | items |
| `StatCard` | Dashboard metric | title, value, icon, trend, color |
| `QuickActions` | Common action buttons | actions |

**Navigation Structure**:
```
Dashboard
├── Servers
├── Projects
├── Members
├── Roles & Permissions
├── Sync
├── Channels (V2)
├── Webhooks (V2)
├── Monitoring (V2)
└── Settings
```

**UI States**:
| State | Display |
|---|---|
| Desktop | Full sidebar + top bar + content area |
| Tablet | Collapsible sidebar + top bar |
| Mobile | Hamburger menu → slide-out sidebar |
| Loading | Skeleton cards for stat cards |
| Error | Error boundary with retry |

**Acceptance Criteria**:
- [ ] Sidebar collapses on mobile (hamburger toggle)
- [ ] Active route highlighted in navigation
- [ ] User avatar and name displayed in top bar
- [ ] Quick stats load on dashboard home (servers count, projects count, members count, sync status)
- [ ] Breadcrumb updates per page
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Dark mode toggle available

**Testing Requirements**:
- [ ] Unit test for Sidebar component
- [ ] Unit test for ProtectedRoute integration
- [ ] Responsive layout tests at 320px, 768px, 1024px, 1440px

**Dependencies**: FE-01, FE-02

---

### FE-04: Server Management UI

**User Story**:
> As a system admin, I want to view, add, edit, and manage Discord servers from the admin panel, so I can control which servers MCDI manages without using API calls directly.

**Key Capabilities**:
- Server list table with filters (active, type, main)
- Server detail page with stats
- Add server modal/form
- Edit server settings
- Enable/disable server toggle with reason
- Delete server confirmation

**Component Breakdown** (all under `features/servers/`):
| Component | File | Props |
|---|---|---|
| `ServerListPage` | `components/ServerListPage.tsx` | — |
| `ServerTable` | `components/ServerTable.tsx` | servers, columns, onAction |
| `ServerForm` | `components/ServerForm.tsx` | server?, onSubmit, mode |
| `ServerDetailPage` | `components/ServerDetailPage.tsx` | serverId |
| `ServerStatusBadge` | `components/ServerStatusBadge.tsx` | isActive, isMain |
| `ServerStatsCard` | `components/ServerStatsCard.tsx` | memberCount, lastSync, status |
| `DisableServerModal` | `components/DisableServerModal.tsx` | serverName, onConfirm |
| `DeleteServerModal` | `components/DeleteServerModal.tsx` | serverName, onConfirm |

**Hooks** (`features/servers/hooks/`):
| Hook | Purpose |
|---|---|
| `useServers` | Fetch paginated server list |
| `useServer` | Fetch single server details |
| `useCreateServer` | Mutation to register server |
| `useUpdateServer` | Mutation to update server |
| `useDeleteServer` | Mutation to delete server |
| `useToggleServerStatus` | Mutation for enable/disable |
| `useServerFilters` | Filter state management |

**API Layer** (`features/servers/api/`):
| File | Purpose |
|---|---|
| `server-api.ts` | All server API functions |
| `server-keys.ts` | TanStack Query key factory |

**Shared components used**: `DataTable`, `Pagination`, `ConfirmDialog`, `EmptyState`, `StatCard` (from `@/shared/`)

**API Calls**:
```
GET    /api/servers                          → List all servers
GET    /api/servers/:serverId                → Get server details
POST   /api/servers                          → Register new server
PATCH  /api/servers/:serverId                → Update server settings
PATCH  /api/servers/:serverId/disable        → Disable server
PATCH  /api/servers/:serverId/enable         → Enable server
DELETE /api/servers/:serverId                → Delete server
```

**Form Fields (Add/Edit Server)**:
| Field | Type | Validation |
|---|---|---|
| Discord Guild ID | text | Required, numeric, 17-20 digits |
| Server Name | text | Auto-filled from Discord, editable |
| Server Type | select | official, partner, other |
| Is Main Server | toggle | Only one can be true |
| Sync Frequency (hours) | number | Min 1, max 24 |
| Default Permission Policy | select | deny_all, allow_all |

**UI States**:
| State | Display |
|---|---|
| Empty | "No servers registered" + "Add Server" button |
| Loading | Table skeleton rows |
| Error | Error banner + retry |
| Success | Toast notification |
| Validation | Inline field errors |

**Acceptance Criteria**:
- [ ] Table shows all servers with status badges (active/inactive, main)
- [ ] Filter by type (official, partner, other)
- [ ] Filter by status (active, inactive)
- [ ] Search by server name
- [ ] Add server form validates Discord guild ID format
- [ ] Enable/disable shows confirmation modal with reason field
- [ ] Server detail shows member count, sync status, last sync time
- [ ] Delete server requires confirmation with "type server name to confirm"
- [ ] Pagination for 20+ servers
- [ ] Server type badge color-coded

**Testing Requirements**:
- [ ] Unit test for ServerForm validation
- [ ] Unit test for ServerTable sorting/filtering
- [ ] E2E test for full CRUD flow

**Dependencies**: FE-01, FE-02, FE-03

---

### FE-05: Project Management UI

**User Story**:
> As a system admin, I want to create and manage projects that integrate with MCDI, so I can control which applications have access to club data and what operations they can perform.

**Key Capabilities**:
- Project list with search and filters
- Create project wizard (name, description, redirect URI, scopes)
- Project detail page with API key display, server access matrix, scopes
- API key rotation flow
- Project activation toggle

**Component Breakdown** (all under `features/projects/`):
| Component | File | Props |
|---|---|---|
| `ProjectListPage` | `components/ProjectListPage.tsx` | — |
| `ProjectTable` | `components/ProjectTable.tsx` | projects, columns, onAction |
| `ProjectForm` | `components/ProjectForm.tsx` | project?, onSubmit, mode |
| `ProjectDetailPage` | `components/ProjectDetailPage.tsx` | projectId |
| `ApiKeyDisplay` | `components/ApiKeyDisplay.tsx` | prefix, onReveal, onRegenerate |
| `ServerAccessMatrix` | `components/ServerAccessMatrix.tsx` | projectId, servers, accessMap, onChange |
| `ScopeSelector` | `components/ScopeSelector.tsx` | scopes, selected, onChange |
| `RedirectUriManager` | `components/RedirectUriManager.tsx` | uris, onAdd, onRemove |
| `ApiKeyRotationModal` | `components/ApiKeyRotationModal.tsx` | projectName, onConfirm |

**Hooks** (`features/projects/hooks/`):
| Hook | Purpose |
|---|---|
| `useProjects` | Fetch paginated project list |
| `useProject` | Fetch single project details |
| `useCreateProject` | Mutation to create project |
| `useUpdateProject` | Mutation to update project |
| `useDeleteProject` | Mutation to delete project |
| `useApiKey` | Fetch/reveal API key info |
| `useRegenerateApiKey` | Mutation to regenerate key |
| `useServerAccessMatrix` | Manage server access grants |
| `useAccessAudit` | Fetch access audit logs |

**API Layer** (`features/projects/api/`):
| File | Purpose |
|---|---|
| `project-api.ts` | All project API functions |
| `project-keys.ts` | TanStack Query key factory |

**Shared components used**: `DataTable`, `Pagination`, `ConfirmDialog`, `EmptyState`, `MaskedInput` (from `@/shared/`)

**API Calls**:
```
POST   /api/admin/projects                           → Create project
GET    /api/admin/projects                           → List all projects
GET    /api/admin/projects/:id                       → Get project details
PATCH  /api/admin/projects/:id                       → Update project
DELETE /api/admin/projects/:id                       → Delete project
GET    /api/admin/projects/:id/api-key               → Reveal API key info
DELETE /api/admin/projects/:id/key                   → Revoke API key
POST   /api/admin/projects/:id/restore-key           → Restore revoked key
POST   /api/admin/projects/:id/regenerate-api-key    → Regenerate key
PUT    /api/admin/projects/:projectId/servers/:serverId  → Grant server access
DELETE /api/admin/projects/:projectId/servers/:serverId  → Revoke server access
GET    /api/admin/projects/:projectId/servers        → List accessible servers
GET    /api/admin/projects/access/matrix             → Full access matrix
```

**Form Fields (Create Project)**:
| Field | Type | Validation |
|---|---|---|
| Project Name | text | Required, 3-50 chars, unique |
| Description | textarea | Optional, max 500 chars |
| Redirect URI | text | Required, valid URL |
| Scopes | checkboxes | At least one: read_members, check_permissions |
| Operations per Server | checkboxes | READ, SEND_MESSAGES, MANAGE_WEBHOOKS |
| Is Internal | toggle | Default false |

**UI States**:
| State | Display |
|---|---|
| API Key Created | One-time reveal modal with copy button + warning |
| API Key Revoked | "Key revoked" badge, restore button |
| Loading | Table skeleton |
| Empty | "No projects" + "Create Project" button |

**Acceptance Criteria**:
- [ ] Create project shows API key ONCE with copy button and warning
- [ ] Server access matrix shows checkboxes per server with operations
- [ ] Scopes can be toggled (read_members, check_permissions)
- [ ] Operations can be configured per server (READ, SEND_MESSAGES, MANAGE_WEBHOOKS)
- [ ] API key regeneration requires confirmation modal
- [ ] Project list shows active/inactive status with toggle
- [ ] Redirect URI supports comma-separated list
- [ ] Access audit log viewable per project

**Testing Requirements**:
- [ ] Unit test for ApiKeyDisplay component
- [ ] Unit test for ServerAccessMatrix
- [ ] E2E test for project creation + API key reveal

**Dependencies**: FE-01, FE-02, FE-03, FE-04 (servers needed for access matrix)

---

### FE-06: Member Management UI

**User Story**:
> As an admin, I want to search, view, and export member data, so I can manage club membership and understand who has access to what.

**Key Capabilities**:
- Member list with pagination
- Search by username, display name, Discord ID
- Filter by role, server, club member status
- Member detail page with profile, cross-server view, roles, permissions
- Export to CSV/JSON

**Component Breakdown** (all under `features/members/`):
| Component | File | Props |
|---|---|---|
| `MemberListPage` | `components/MemberListPage.tsx` | — |
| `MemberTable` | `components/MemberTable.tsx` | members, columns, pagination |
| `MemberFilters` | `components/MemberFilters.tsx` | roles, servers, onFilterChange |
| `MemberDetailPage` | `components/MemberDetailPage.tsx` | memberId |
| `MemberProfileCard` | `components/MemberProfileCard.tsx` | member |
| `CrossServerView` | `components/CrossServerView.tsx` | memberId, servers |
| `RoleList` | `components/RoleList.tsx` | roles, serverName |
| `PermissionSummary` | `components/PermissionSummary.tsx` | permissions |
| `ExportButton` | `components/ExportButton.tsx` | format, filters |
| `SearchInput` | `components/SearchInput.tsx` | value, onChange, debounce |

**Hooks** (`features/members/hooks/`):
| Hook | Purpose |
|---|---|
| `useMembers` | Fetch paginated member list |
| `useMember` | Fetch single member details |
| `useMemberPermissions` | Fetch member's effective permissions |
| `useCrossServerView` | Fetch cross-server memberships |
| `useMemberFilters` | Filter state management |
| `useMemberSearch` | Debounced search |
| `useExportMembers` | CSV/JSON export |

**API Layer** (`features/members/api/`):
| File | Purpose |
|---|---|
| `member-api.ts` | All member API functions |
| `member-keys.ts` | TanStack Query key factory |

**Shared components used**: `DataTable`, `Pagination`, `SearchInput`, `EmptyState`, `LoadingSkeleton` (from `@/shared/`)

**API Calls**:
```
GET  /api/servers/:serverId/members              → List members (paginated)
GET  /api/servers/:serverId/members/:discordId   → Get member by ID
GET  /api/servers/:serverId/members/:discordId/permissions → Get permissions
GET  /api/admin/members/:discordId/servers       → Cross-server view
GET  /api/admin/members/cross-server             → Paginated cross-server list
GET  /api/admin/members/export?format=csv|json   → Export members
```

**Filter Options**:
| Filter | Type | Options |
|---|---|---|
| Search | text | Partial name match |
| Server | multi-select | All registered servers |
| Role | multi-select | All roles in selected server |
| Club Member | toggle | true/false/any |
| Active | toggle | true/false/any |

**UI States**:
| State | Display |
|---|---|
| Empty | "No members found" + clear filters button |
| Loading | Table skeleton |
| Detail Loading | Profile skeleton card |
| Exporting | Progress indicator |

**Acceptance Criteria**:
- [ ] Table supports pagination (50/100/200 per page)
- [ ] Search works with partial matches (debounced 300ms)
- [ ] Filter by multiple roles simultaneously
- [ ] Member detail shows all server memberships with roles
- [ ] Export button downloads CSV/JSON with current filters applied
- [ ] Avatar displayed in member list
- [ ] Click member row opens detail page
- [ ] Permission summary shows resolved permissions

**Testing Requirements**:
- [ ] Unit test for MemberFilters
- [ ] Unit test for pagination logic
- [ ] E2E test for search + filter + export flow

**Dependencies**: FE-01, FE-02, FE-03

---

### FE-07: Member Statistics Dashboard

**User Story**:
> As a club admin, I want to see visual member statistics and growth trends, so I can understand club health and report on participation.

**Key Capabilities**:
- Total member count with growth indicator
- Members by role (pie/bar chart)
- Members by department
- New members last 30 days
- Active vs inactive ratio
- Member growth over time (line chart)
- Cross-server membership stats

**Component Breakdown** (all under `features/stats/`):
| Component | File | Props |
|---|---|---|
| `StatsDashboard` | `components/StatsDashboard.tsx` | — |
| `MemberCountCard` | `components/MemberCountCard.tsx` | count, trend, period |
| `RoleDistributionChart` | `components/RoleDistributionChart.tsx` | data, colors |
| `GrowthChart` | `components/GrowthChart.tsx` | data, dateRange |
| `ActiveInactiveRatio` | `components/ActiveInactiveRatio.tsx` | active, inactive |
| `ServerComparisonChart` | `components/ServerComparisonChart.tsx` | servers, metrics |
| `DateRangePicker` | `components/DateRangePicker.tsx` | value, onChange |
| `ExportStatsButton` | `components/ExportStatsButton.tsx` | format |

**Hooks** (`features/stats/hooks/`):
| Hook | Purpose |
|---|---|
| `useMemberStats` | Fetch aggregate member stats |
| `useMemberGrowth` | Fetch growth timeline data |
| `useRoleStats` | Fetch role distribution |
| `useServerStats` | Fetch server-level stats |

**API Layer** (`features/stats/api/`):
| File | Purpose |
|---|---|
| `stats-api.ts` | All stats API functions |
| `stats-keys.ts` | TanStack Query key factory |

**Shared components used**: `StatCard`, `LoadingSkeleton`, `EmptyState`, `ErrorBoundary` (from `@/shared/`)

**API Calls**:
```
GET  /api/admin/stats/members              → Aggregate statistics
GET  /api/admin/stats/members/growth       → Growth over time
GET  /api/admin/stats/roles                → Role distribution
GET  /api/admin/stats/servers              → Server statistics
```

**Chart Specifications**:
| Chart | Type | Data Source | Refresh |
|---|---|---|---|
| Total Members | Number card + trend arrow | /stats/members | On load |
| Role Distribution | Pie chart | /stats/roles | On load |
| Growth Over Time | Line chart (30/90/365 days) | /stats/members/growth | On load |
| Active/Inactive | Donut chart | /stats/members | On load |
| Server Comparison | Grouped bar chart | /stats/servers | On load |

**UI States**:
| State | Display |
|---|---|
| Loading | Chart skeletons |
| No Data | "Not enough data yet" message |
| Error | Error banner with retry |

**Acceptance Criteria**:
- [ ] Charts render with real data from API
- [ ] Stats update on page load
- [ ] Date range selector for time-based charts (7d, 30d, 90d, 1y)
- [ ] Charts are responsive and accessible
- [ ] Export stats as PNG image or CSV data
- [ ] Tooltips on chart hover show exact values

**Testing Requirements**:
- [ ] Unit test for chart data transformation
- [ ] Visual regression test for charts

**Dependencies**: FE-01, FE-02, FE-03, BE-03 (Member Statistics API)

---

### FE-08: Role & Permission Management UI

**User Story**:
> As an admin, I want to manage role-permission mappings and configure inheritance rules, so I can control what each role can access across servers.

**Key Capabilities**:
- Role list per server
- Role detail with permissions
- Add/remove permissions from roles
- Role hierarchy visualization
- Permission matrix view
- Inheritance rules configuration
- Impact preview (how many members affected)

**Component Breakdown** (all under `features/roles/`):
| Component | File | Props |
|---|---|---|
| `RoleListPage` | `components/RoleListPage.tsx` | serverId |
| `RoleTable` | `components/RoleTable.tsx` | roles, columns |
| `RoleDetailPage` | `components/RoleDetailPage.tsx` | roleId |
| `PermissionMatrix` | `components/PermissionMatrix.tsx` | roles, permissions, onChange |
| `PermissionCheckbox` | `components/PermissionCheckbox.tsx` | permission, checked, onChange |
| `HierarchyTree` | `components/HierarchyTree.tsx` | roles, levels |
| `InheritanceRuleForm` | `components/InheritanceRuleForm.tsx` | rule, servers, onSave |
| `ImpactPreview` | `components/ImpactPreview.tsx` | changes |
| `ServerSelector` | `components/ServerSelector.tsx` | servers, selected, onChange |

**Hooks** (`features/roles/hooks/`):
| Hook | Purpose |
|---|---|
| `useRoles` | Fetch roles for a server |
| `useRole` | Fetch single role details |
| `useRolePermissions` | Fetch role's permissions |
| `useAssignPermissions` | Mutation to add permissions |
| `useRemovePermission` | Mutation to remove permission |
| `useImpactPreview` | Preview affected members |
| `useInheritanceRules` | Fetch inheritance rules |
| `useCreateInheritanceRule` | Mutation to create rule |

**API Layer** (`features/roles/api/`):
| File | Purpose |
|---|---|
| `role-api.ts` | All role API functions |
| `role-keys.ts` | TanStack Query key factory |

**Shared components used**: `DataTable`, `ConfirmDialog`, `EmptyState`, `LoadingSkeleton` (from `@/shared/`)

**API Calls**:
```
GET    /api/servers/:serverId/roles                      → List roles
GET    /api/admin/servers/:serverId/roles/:roleId/permissions → Get role permissions
POST   /api/admin/servers/:serverId/roles/:roleId/permissions → Add permissions
DELETE /api/admin/servers/:serverId/roles/:roleId/permissions/:permissionId → Remove
GET    /api/admin/servers/:serverId/roles/:roleId/impact → Preview affected members
POST   /api/permissions/inheritance-rules                → Create/update rule
GET    /api/permissions/inheritance-rules                → List rules
```

**UI States**:
| State | Display |
|---|---|
| Loading | Table skeleton |
| Saving | Inline spinner on changed row |
| Impact Preview | "X members will be affected" banner |
| Protected Role | Warning badge "Executive role — cannot remove permissions" |

**Acceptance Criteria**:
- [ ] Role list shows permission count per role
- [ ] Permission checkboxes for each role (bulk edit supported)
- [ ] Changes save immediately or with confirm button
- [ ] Hierarchy shows parent-child relationships visually
- [ ] Impact preview shows affected member count before save
- [ ] Executive role protected (warning displayed, changes blocked)
- [ ] Inheritance rules can be configured with target servers
- [ ] Server context selector switches role view

**Testing Requirements**:
- [ ] Unit test for PermissionMatrix
- [ ] Unit test for ImpactPreview calculation
- [ ] E2E test for permission assignment flow

**Dependencies**: FE-01, FE-02, FE-03, BE-04 (Role Management API)

---

### FE-09: Sync Management UI

**User Story**:
> As a system admin, I want to monitor and trigger data synchronization between Discord and MCDI, so I can ensure member data is always up to date.

**Key Capabilities**:
- Sync status overview (all servers)
- Trigger full sync button
- Sync progress indicator
- Sync log history with pagination
- Sync change details viewer
- Error display for failed syncs

**Component Breakdown** (all under `features/sync/`):
| Component | File | Props |
|---|---|---|
| `SyncDashboard` | `components/SyncDashboard.tsx` | — |
| `SyncStatusCard` | `components/SyncStatusCard.tsx` | server, status, lastSync |
| `SyncTriggerButton` | `components/SyncTriggerButton.tsx` | serverId, type, onTrigger |
| `SyncProgressBar` | `components/SyncProgressBar.tsx` | progress, stage |
| `SyncLogTable` | `components/SyncLogTable.tsx` | logs, pagination |
| `SyncChangeDetail` | `components/SyncChangeDetail.tsx` | changes |
| `SyncErrorModal` | `components/SyncErrorModal.tsx` | error, syncLog |

**Hooks** (`features/sync/hooks/`):
| Hook | Purpose |
|---|---|
| `useSyncStatus` | Fetch sync status for all servers |
| `useTriggerSync` | Mutation to trigger sync |
| `useSyncLogs` | Fetch paginated sync logs |
| `useSyncChanges` | Fetch change details for a log |
| `useSyncAutoRefresh` | Polling during active sync |

**API Layer** (`features/sync/api/`):
| File | Purpose |
|---|---|
| `sync-api.ts` | All sync API functions |
| `sync-keys.ts` | TanStack Query key factory |

**Shared components used**: `StatCard`, `DataTable`, `Pagination`, `LoadingSkeleton`, `EmptyState` (from `@/shared/`)

**API Calls**:
```
POST /api/admin/sync/full                        → Trigger full sync
GET  /api/admin/sync/status/all                  → Get all server sync status
GET  /api/admin/sync/status?serverId=:id         → Get single server status
GET  /api/admin/sync/logs                        → Paginated sync logs
GET  /api/admin/sync/logs/:syncLogId/changes     → Granular change details
```

**UI States**:
| State | Display |
|---|---|
| Idle | "Last sync: X hours ago" + "Sync Now" button |
| Syncing | Progress bar with stage label (Members → Roles → Complete) |
| Success | Green checkmark + summary (X members, Y roles synced) |
| Failed | Red error banner + "View Details" button |
| Loading | Status card skeletons |

**Acceptance Criteria**:
- [ ] Status shows last sync time per server with color-coded indicator
- [ ] Progress bar during active sync with stage labels
- [ ] Sync logs show timestamp, status, members/roles synced
- [ ] Click log entry expands to show change details
- [ ] Failed syncs show error message with stack trace option
- [ ] Auto-refresh every 30 seconds during active sync
- [ ] Pagination for sync log history

**Testing Requirements**:
- [ ] Unit test for SyncProgressBar
- [ ] Unit test for auto-refresh logic
- [ ] E2E test for triggering sync and viewing results

**Dependencies**: FE-01, FE-02, FE-03

---

### FE-10: Discord Channel Operations UI

**User Story**:
> As a project developer or admin, I want to send messages to Discord channels and view channel information through the admin panel, so I can manage communications without leaving MCDI.

**Key Capabilities**:
- Channel list per server (tree view by category)
- Channel detail (name, topic, type, permissions)
- Send message modal with text editor and embed builder
- Message preview
- Message history viewer

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `ChannelBrowser` | Channel tree view | serverId, channels |
| `ChannelTree` | Category → channel hierarchy | categories, channels |
| `ChannelDetail` | Channel info panel | channel |
| `MessageComposer` | Message editor | channelId, onSend |
| `EmbedBuilder` | Rich embed form | embed, onChange |
| `MessagePreview` | Discord-style preview | message, embed |
| `MessageHistory` | Recent messages | channelId, messages |
| `ServerContextSelector` | Switch server context | servers, selected |

**API Calls**:
```
GET  /api/servers/:serverId/channels                    → List channels
GET  /api/servers/:serverId/channels/:channelId         → Get channel details
POST /api/servers/:serverId/channels/:channelId/messages → Send message
GET  /api/servers/:serverId/channels/:channelId/messages → Get message history
```

**Message Composer Fields**:
| Field | Type | Validation |
|---|---|---|
| Content | textarea | Max 2000 chars |
| Channel | select | Required |
| Embed Title | text | Optional, max 256 chars |
| Embed Description | textarea | Optional, max 4096 chars |
| Embed Color | color picker | Optional |
| Embed Image URL | text | Optional, valid URL |
| Mention @everyone | toggle | Requires permission |

**UI States**:
| State | Display |
|---|---|
| Empty | "Select a channel to compose" |
| Composing | Text editor + embed builder side by side |
| Preview | Discord-style message preview |
| Sending | Spinner + "Sending..." |
| Sent | Toast "Message sent" + clear form |
| Rate Limited | Warning "Rate limited — wait X seconds" |

**Acceptance Criteria**:
- [ ] Channels grouped by category in tree view
- [ ] Send message supports plain text and embeds
- [ ] Preview shows how message will look in Discord
- [ ] Rate limit warnings displayed prominently
- [ ] Only channels the user's project has access to are shown
- [ ] Message history loads on demand (last 50 messages)
- [ ] Character counter for message content

**Testing Requirements**:
- [ ] Unit test for EmbedBuilder
- [ ] Unit test for MessagePreview rendering
- [ ] E2E test for sending message and verifying in Discord

**Dependencies**: FE-01, FE-02, FE-03, BE-01 (Channel Operations API)

---

### FE-11: Webhook Management UI

**User Story**:
> As a project developer, I want to create, manage, and test webhooks for Discord channels, so I can send messages efficiently without hitting rate limits.

**Key Capabilities**:
- Webhook list per project
- Create webhook form (name, avatar, channel)
- Webhook detail with usage stats
- Edit webhook settings
- Delete webhook confirmation
- Test webhook button

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `WebhookListPage` | Webhooks page | projectId |
| `WebhookTable` | Webhook data table | webhooks, columns |
| `WebhookForm` | Create/Edit form | webhook?, onSubmit |
| `WebhookDetail` | Detail + stats | webhook |
| `WebhookStatsCard` | Usage metrics | usageCount, lastUsed |
| `TestWebhookModal` | Test message form | webhookId, onTest |
| `ChannelSelector` | Channel picker | channels, selected |

**API Calls**:
```
POST   /api/servers/:serverId/channels/:channelId/webhooks → Create webhook
GET    /api/projects/:projectId/webhooks                   → List project webhooks
GET    /api/webhooks/:webhookId                            → Get webhook details
PATCH  /api/webhooks/:webhookId                            → Update webhook
DELETE /api/webhooks/:webhookId                            → Delete webhook
POST   /api/webhooks/:webhookId/execute                    → Execute webhook
```

**Form Fields (Create Webhook)**:
| Field | Type | Validation |
|---|---|---|
| Name | text | Required, 2-80 chars |
| Channel | select | Required, from accessible channels |
| Avatar | file upload | Optional, image, max 256KB |

**UI States**:
| State | Display |
|---|---|
| Empty | "No webhooks" + "Create Webhook" button |
| Loading | Table skeleton |
| Testing | Spinner + "Sending test message..." |
| Test Success | Green checkmark + "Test message sent" |
| Test Failed | Error details + retry |

**Acceptance Criteria**:
- [ ] Webhook list shows name, channel, last used, usage count
- [ ] Create form validates channel access
- [ ] Usage stats show message count and last used timestamp
- [ ] Test webhook sends sample message to Discord
- [ ] Delete requires confirmation modal
- [ ] Avatar upload with preview
- [ ] Webhook URL never displayed (security)

**Testing Requirements**:
- [ ] Unit test for WebhookForm validation
- [ ] Unit test for TestWebhookModal
- [ ] E2E test for webhook creation and execution

**Dependencies**: FE-01, FE-02, FE-03, BE-02 (Webhook Management API)

---

### FE-12: System Monitoring & Audit UI

**User Story**:
> As a club admin, I want to monitor system usage and view audit logs, so I can identify issues, track project activity, and ensure security compliance.

**Key Capabilities**:
- API usage dashboard (requests per project)
- Error rate monitoring
- Recent auth failures
- System health indicators (API, Discord bot, DB, Redis)
- Audit log viewer with filters
- Export audit logs

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `MonitoringDashboard` | Monitoring overview | — |
| `UsageChart` | Requests over time | data, projectFilter |
| `ErrorRateChart` | Errors over time | data |
| `HealthIndicator` | Service status | service, status, latency |
| `AuthFailureTable` | Recent failures | failures |
| `AuditLogTable` | Audit log viewer | logs, filters, pagination |
| `AuditLogFilters` | Filter controls | dateRange, user, action |
| `ExportAuditButton` | Export logs | format, filters |

**API Calls**:
```
GET  /api/admin/monitoring/usage           → API usage stats
GET  /api/admin/monitoring/errors          → Error stats
GET  /api/admin/monitoring/health          → System health
GET  /api/admin/monitoring/auth-failures   → Recent auth failures
GET  /api/admin/audit/logs                 → Audit logs (paginated)
GET  /api/admin/audit/logs/export          → Export audit logs
```

**Health Indicators**:
| Service | Status | Details |
|---|---|---|
| API | Online/Offline | Response time, uptime |
| Discord Bot | Connected/Disconnected | Guild count, latency |
| PostgreSQL | Connected/Disconnected | Query time, connections |
| Redis | Connected/Disconnected | Hit rate, memory |

**Audit Log Filters**:
| Filter | Type | Options |
|---|---|---|
| Date Range | date picker | Custom range |
| User | multi-select | Admin users |
| Action Type | checkboxes | auth, project, server, role, webhook |
| Severity | select | info, warning, error |

**UI States**:
| State | Display |
|---|---|
| Loading | Chart skeletons + health check spinners |
| Healthy | All green indicators |
| Degraded | Yellow indicator with details |
| Down | Red indicator + alert banner |

**Acceptance Criteria**:
- [ ] Usage charts show requests over time per project
- [ ] Health indicators show API/Discord/DB/Redis status
- [ ] Audit log searchable by date, user, action type
- [ ] Export audit log as CSV
- [ ] Auth failures show IP, timestamp, reason
- [ ] Auto-refresh health indicators every 60 seconds

**Testing Requirements**:
- [ ] Unit test for HealthIndicator component
- [ ] Unit test for AuditLogFilters
- [ ] E2E test for audit log search and export

**Dependencies**: FE-01, FE-02, FE-03, BE-05 (Audit Logging)

---

### FE-13: Settings & Configuration UI

**User Story**:
> As an admin, I want to configure system settings and manage my profile, so I can customize MCDI behavior without editing environment files.

**Key Capabilities**:
- Admin profile settings
- Discord configuration (client ID, bot token — masked)
- Cache TTL settings
- Rate limit configuration
- System preferences

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `SettingsPage` | Settings container | — |
| `ProfileSettings` | Admin profile | profile, onSave |
| `DiscordConfigForm` | Discord credentials | config, onSave |
| `CacheSettings` | TTL configuration | settings, onSave |
| `RateLimitSettings` | Rate limit config | limits, onSave |
| `MaskedInput` | Sensitive value input | value, onReveal, onChange |
| `SettingsSection` | Grouped settings | title, description, children |

**API Calls**:
```
GET  /api/admin/settings              → Get current settings
PATCH /api/admin/settings             → Update settings
GET  /api/admin/profile               → Get admin profile
PATCH /api/admin/profile              → Update profile
```

**UI States**:
| State | Display |
|---|---|
| Loading | Form skeletons |
| Editing | Inline edit mode with save/cancel |
| Saved | Toast "Settings saved" |
| Validation | Inline field errors |

**Acceptance Criteria**:
- [ ] Sensitive values masked with reveal toggle (••••••)
- [ ] Settings save with confirmation toast
- [ ] Validation errors shown inline
- [ ] Reset to defaults button
- [ ] Settings grouped by category with clear headings

**Testing Requirements**:
- [ ] Unit test for MaskedInput
- [ ] Unit test for form validation

**Dependencies**: FE-01, FE-02, FE-03

---

### FE-14: Responsive Design & Mobile Support

**User Story**:
> As an admin who occasionally checks the system from my phone, I want the admin panel to work well on mobile devices, so I can monitor and manage MCDI on the go.

**Key Capabilities**:
- Mobile-first responsive layouts
- Touch-friendly interactions
- Mobile navigation (hamburger menu)
- Optimized tables for mobile (card view)
- Swipe actions on mobile

**Component Breakdown**:
| Component | Purpose | Props |
|---|---|---|
| `MobileNav` | Hamburger menu | items, isOpen, onClose |
| `CardTable` | Mobile table alternative | items, renderCard |
| `SwipeActions` | Swipe-to-action on mobile | children, actions |
| `ResponsiveWrapper` | Breakpoint handler | children, breakpoints |

**Breakpoint Specifications**:
| Breakpoint | Width | Layout |
|---|---|---|
| xs | < 640px | Single column, card tables, hamburger nav |
| sm | 640-768px | Single column, compact tables |
| md | 768-1024px | Collapsible sidebar |
| lg | 1024-1280px | Full sidebar |
| xl | > 1280px | Full layout with extra space |

**Acceptance Criteria**:
- [ ] All pages work on 320px+ screens
- [ ] Tables convert to cards on mobile (< 768px)
- [ ] Touch targets minimum 44px × 44px
- [ ] No horizontal scrolling on mobile
- [ ] Forms stack vertically on mobile
- [ ] Charts resize and remain readable
- [ ] Swipe gestures for common actions (delete, edit)

**Testing Requirements**:
- [ ] Responsive visual regression tests at all breakpoints
- [ ] Touch interaction tests on mobile viewport
- [ ] Lighthouse mobile performance score > 80

**Dependencies**: All FE issues (applied across all pages)

---

## 4. Backend Specification

### BE-01: Discord Channel Operations API

**User Story**:
> As a project developer, I want to send messages to Discord channels through MCDI's API, so I can notify users about important events without building Discord integration myself.

**New Endpoints**:

#### `POST /api/servers/:serverId/channels/:channelId/messages`
Send a message to a Discord channel.

**Auth**: API Key + `SEND_MESSAGES` operation on project-server access

**Request Body**:
```json
{
  "content": "string (max 2000 chars, optional if embeds provided)",
  "embeds": [
    {
      "title": "string (max 256 chars)",
      "description": "string (max 4096 chars)",
      "url": "string (valid URL)",
      "color": "integer (0-16777215)",
      "image": { "url": "string" },
      "thumbnail": { "url": "string" },
      "footer": { "text": "string", "icon_url": "string" },
      "author": { "name": "string", "url": "string", "icon_url": "string" }
    }
  ],
  "allowed_mentions": {
    "parse": ["everyone", "roles", "users"],
    "users": ["string (Discord IDs)"],
    "roles": ["string (Discord IDs)"]
  },
  "tts": "boolean (default false)"
}
```

**Response (201)**:
```json
{
  "id": "string (Discord message ID)",
  "channelId": "string",
  "content": "string",
  "timestamp": "ISO 8601",
  "author": { "id": "string", "username": "string" }
}
```

**Error Responses**:
| Status | Code | Message |
|---|---|---|
| 400 | INVALID_CONTENT | Content exceeds 2000 characters |
| 403 | NO_SEND_PERMISSION | Project lacks SEND_MESSAGES operation |
| 404 | CHANNEL_NOT_FOUND | Channel does not exist or bot lacks access |
| 429 | RATE_LIMITED | Rate limit exceeded, retry after X seconds |

**Rate Limit**: 5 messages per minute per project

---

#### `GET /api/servers/:serverId/channels`
List all channels in a server.

**Auth**: API Key + `READ` operation

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| type | string | all | Filter: text, voice, announcement, category |
| categoryId | string | — | Filter by parent category |

**Response (200)**:
```json
{
  "channels": [
    {
      "id": "string",
      "name": "string",
      "type": "text | voice | announcement | category",
      "position": "integer",
      "parentId": "string | null",
      "topic": "string | null",
      "nsfw": "boolean",
      "permissionOverwrites": "boolean"
    }
  ],
  "categories": [
    {
      "id": "string",
      "name": "string",
      "position": "integer",
      "children": ["string (channel IDs)"]
    }
  ]
}
```

---

#### `GET /api/servers/:serverId/channels/:channelId`
Get channel details.

**Auth**: API Key + `READ` operation

**Response (200)**:
```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "position": "integer",
  "parentId": "string | null",
  "topic": "string | null",
  "nsfw": "boolean",
  "lastMessageId": "string | null",
  "createdAt": "ISO 8601"
}
```

---

#### `GET /api/servers/:serverId/channels/:channelId/messages`
Get recent messages from a channel.

**Auth**: API Key + `READ` operation

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| limit | integer | 50 | Max 100 |
| before | string | — | Get messages before this ID |
| after | string | — | Get messages after this ID |
| authorId | string | — | Filter by author |

**Response (200)**:
```json
{
  "messages": [
    {
      "id": "string",
      "content": "string",
      "author": { "id": "string", "username": "string", "avatar": "string" },
      "timestamp": "ISO 8601",
      "embeds": "array",
      "attachments": "array",
      "mentions": "array"
    }
  ],
  "hasMore": "boolean"
}
```

**Rate Limit**: 10 requests per minute per project

---

**DTOs Required**:
| DTO | File | Fields |
|---|---|---|
| `SendMessageDto` | `channels/dto/send-message.dto.ts` | content, embeds, allowed_mentions, tts |
| `EmbedDto` | `channels/dto/embed.dto.ts` | title, description, url, color, image, thumbnail, footer, author |
| `AllowedMentionsDto` | `channels/dto/allowed-mentions.dto.ts` | parse, users, roles |
| `ListChannelsQueryDto` | `channels/dto/list-channels-query.dto.ts` | type, categoryId |
| `ListMessagesQueryDto` | `channels/dto/list-messages-query.dto.ts` | limit, before, after, authorId |

**Module Structure**:
```
src/modules/channels/
├── channels.module.ts
├── channels.controller.ts
├── channels.service.ts
├── dto/
│   ├── send-message.dto.ts
│   ├── embed.dto.ts
│   ├── allowed-mentions.dto.ts
│   ├── list-channels-query.dto.ts
│   └── list-messages-query.dto.ts
└── guards/
    └── channel-access.guard.ts
```

**Acceptance Criteria**:
- [ ] Messages sent within 3 seconds
- [ ] Rate limits enforced (5 msg/min per project)
- [ ] Only authorized projects can send (SEND_MESSAGES operation check)
- [ ] Embeds fully supported with validation
- [ ] Channel list returns only bot-accessible channels
- [ ] Message history respects Discord rate limits
- [ ] All endpoints documented in Swagger

**Testing Requirements**:
- [ ] Unit test for ChannelsService
- [ ] Unit test for ChannelAccessGuard
- [ ] Integration test for send message (mocked Discord API)
- [ ] Rate limit test (verify 429 after 6th message)

**Security Rules**:
| Rule | Enforcement |
|---|---|
| Send message permission | Project must have `SEND_MESSAGES` operation in `project_servers.operations` |
| Channel access | Only channels the bot can access are returned |
| Rate limit | 5 messages/minute per project, 10 message history requests/minute |
| @everyone mention | Requires explicit `allowed_mentions.parse` with "everyone" |
| Content validation | Max 2000 chars, embed fields validated per Discord limits |

**Dependencies**: Existing Discord service (methods already implemented)

---

### BE-02: Webhook Management API

**User Story**:
> As a project developer, I want to create and manage Discord webhooks through MCDI, so I can send high-volume messages without hitting bot rate limits.

**New Endpoints**:

#### `POST /api/servers/:serverId/channels/:channelId/webhooks`
Create a webhook for a channel.

**Auth**: API Key + `MANAGE_WEBHOOKS` operation

**Request Body**:
```json
{
  "name": "string (2-80 chars)",
  "avatar": "string (base64 image, optional, max 256KB)"
}
```

**Response (201)**:
```json
{
  "id": "string (webhook ID)",
  "name": "string",
  "channelId": "string",
  "serverId": "string",
  "projectId": "string",
  "createdAt": "ISO 8601",
  "usageCount": 0
}
```

**Note**: The actual webhook URL is encrypted and stored server-side. It is NEVER returned in API responses.

---

#### `GET /api/projects/:projectId/webhooks`
List all webhooks for a project.

**Auth**: API Key

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| serverId | string | — | Filter by server |
| limit | integer | 50 | Max 100 |
| offset | integer | 0 | Pagination |

**Response (200)**:
```json
{
  "webhooks": [
    {
      "id": "string",
      "name": "string",
      "channelId": "string",
      "channelName": "string",
      "serverId": "string",
      "serverName": "string",
      "createdAt": "ISO 8601",
      "usageCount": "integer",
      "lastUsedAt": "ISO 8601 | null"
    }
  ],
  "total": "integer",
  "limit": "integer",
  "offset": "integer"
}
```

---

#### `GET /api/webhooks/:webhookId`
Get webhook details.

**Auth**: API Key (webhook must belong to requesting project)

**Response (200)**:
```json
{
  "id": "string",
  "name": "string",
  "channelId": "string",
  "channelName": "string",
  "serverId": "string",
  "serverName": "string",
  "avatar": "string | null",
  "createdAt": "ISO 8601",
  "usageCount": "integer",
  "lastUsedAt": "ISO 8601 | null"
}
```

---

#### `PATCH /api/webhooks/:webhookId`
Update webhook settings.

**Auth**: API Key (webhook must belong to requesting project)

**Request Body**:
```json
{
  "name": "string (2-80 chars, optional)",
  "avatar": "string (base64 or null to remove, optional)"
}
```

**Response (200)**: Updated webhook object

---

#### `DELETE /api/webhooks/:webhookId`
Delete a webhook.

**Auth**: API Key (webhook must belong to requesting project)

**Response (204)**: No content

---

#### `POST /api/webhooks/:webhookId/execute`
Execute a webhook (send message).

**Auth**: API Key (webhook must belong to requesting project)

**Request Body**:
```json
{
  "content": "string (max 2000 chars, optional)",
  "embeds": "array (same as SendMessageDto)",
  "username": "string (override webhook name, optional)",
  "avatar_url": "string (override webhook avatar, optional)"
}
```

**Response (204)**: No content (webhook execution is fire-and-forget)

**Note**: Usage count incremented, execution logged in audit table.

---

**DTOs Required**:
| DTO | File | Fields |
|---|---|---|
| `CreateWebhookDto` | `webhooks/dto/create-webhook.dto.ts` | name, avatar |
| `UpdateWebhookDto` | `webhooks/dto/update-webhook.dto.ts` | name, avatar |
| `ExecuteWebhookDto` | `webhooks/dto/execute-webhook.dto.ts` | content, embeds, username, avatar_url |
| `ListWebhooksQueryDto` | `webhooks/dto/list-webhooks-query.dto.ts` | serverId, limit, offset |

**Module Structure**:
```
src/modules/webhooks/
├── webhooks.module.ts
├── webhooks.controller.ts
├── webhooks.service.ts
├── dto/
│   ├── create-webhook.dto.ts
│   ├── update-webhook.dto.ts
│   ├── execute-webhook.dto.ts
│   └── list-webhooks-query.dto.ts
├── webhooks.repository.ts
└── guards/
    └── webhook-ownership.guard.ts
```

**Database Migration** (0012):
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  server_id VARCHAR(255) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id VARCHAR(255) NOT NULL,
  discord_webhook_id VARCHAR(255) NOT NULL,
  name VARCHAR(80) NOT NULL,
  avatar TEXT,
  url_encrypted TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_webhooks_project_id ON webhooks(project_id);
CREATE INDEX idx_webhooks_server_id ON webhooks(server_id);
CREATE INDEX idx_webhooks_channel_id ON webhooks(channel_id);
CREATE INDEX idx_webhooks_discord_id ON webhooks(discord_webhook_id);
```

**Security Rules**:
| Rule | Enforcement |
|---|---|
| Webhook URL never returned in API responses | Encrypted at rest (AES-256), decrypted only for execution |
| Webhook ownership check | Every operation verifies webhook belongs to requesting project |
| Max webhooks per project | 10 (configurable via `MAX_WEBHOOKS_PER_PROJECT`) |
| Channel access check | Project must have `MANAGE_WEBHOOKS` operation on the server |
| Rate limit on execution | 30 requests/minute per project |

**Acceptance Criteria**:
- [ ] Webhook URL encrypted in storage (AES-256)
- [ ] Execution tracked in database (usage_count, last_used_at)
- [ ] Failed executions retried (3 attempts with exponential backoff)
- [ ] Only authorized projects can manage webhooks (MANAGE_WEBHOOKS operation)
- [ ] Webhook ownership verified on every operation
- [ ] Maximum 10 webhooks per project (configurable)
- [ ] All endpoints documented in Swagger

**Testing Requirements**:
- [ ] Unit test for WebhooksService encryption/decryption
- [ ] Unit test for WebhookOwnershipGuard
- [ ] Integration test for webhook creation
- [ ] Integration test for webhook execution
- [ ] Retry logic test (mock failed execution)

**Dependencies**: BE-01 (Channel Operations — shares channel access logic)

---

### BE-03: Member Statistics API

**User Story**:
> As a club admin, I want to query aggregate member statistics, so I can generate reports and understand club growth without manual data processing.

**New Endpoints**:

#### `GET /api/admin/stats/members`
Get aggregate member statistics.

**Auth**: Bearer Token (Admin only)

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| serverId | string | — | Filter by server |
| dateRange | string | 30d | 7d, 30d, 90d, 1y |

**Response (200)**:
```json
{
  "totalMembers": "integer",
  "clubMembers": "integer",
  "nonClubMembers": "integer",
  "activeMembers": "integer",
  "inactiveMembers": "integer",
  "newMembersThisPeriod": "integer",
  "growthRate": "float (percentage)",
  "byRole": [
    { "roleName": "string", "count": "integer", "percentage": "float" }
  ],
  "byServer": [
    { "serverId": "string", "serverName": "string", "memberCount": "integer" }
  ]
}
```

---

#### `GET /api/admin/stats/members/growth`
Get member growth over time.

**Auth**: Bearer Token (Admin only)

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| period | string | 30d | 7d, 30d, 90d, 1y |
| granularity | string | daily | daily, weekly, monthly |

**Response (200)**:
```json
{
  "data": [
    { "date": "ISO 8601", "count": "integer", "newMembers": "integer", "leftMembers": "integer" }
  ],
  "period": "string",
  "totalGrowth": "integer"
}
```

---

#### `GET /api/admin/stats/roles`
Get role distribution.

**Auth**: Bearer Token (Admin only)

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| serverId | string | required | Server to analyze |

**Response (200)**:
```json
{
  "serverId": "string",
  "serverName": "string",
  "roles": [
    {
      "roleId": "string",
      "roleName": "string",
      "memberCount": "integer",
      "hierarchyLevel": "integer",
      "color": "integer | null"
    }
  ],
  "totalMembers": "integer"
}
```

---

#### `GET /api/admin/stats/servers`
Get server-level statistics.

**Auth**: Bearer Token (Admin only)

**Response (200)**:
```json
{
  "servers": [
    {
      "serverId": "string",
      "serverName": "string",
      "memberCount": "integer",
      "activeMembers": "integer",
      "roleCount": "integer",
      "lastSync": "ISO 8601",
      "syncStatus": "string"
    }
  ],
  "totalServers": "integer",
  "totalMembers": "integer"
}
```

---

**Module Structure**:
```
src/modules/stats/
├── stats.module.ts
├── stats.controller.ts
├── stats.service.ts
└── dto/
    └── stats-query.dto.ts
```

**Acceptance Criteria**:
- [ ] Stats computed efficiently (use database aggregates, not iteration)
- [ ] Date range parameters supported
- [ ] Response includes all required metrics
- [ ] Cached results with 5-minute TTL (Redis)
- [ ] All endpoints documented in Swagger

**Testing Requirements**:
- [ ] Unit test for StatsService aggregation logic
- [ ] Integration test for each stats endpoint
- [ ] Cache invalidation test

**Dependencies**: Existing database schema (no new tables needed)

**Security Rules**:
| Rule | Enforcement |
|---|---|
| Admin-only access | All stats endpoints require Bearer token + admin role |
| Redis caching | 5-minute TTL to prevent expensive aggregate queries under load |
| No PII exposure | Stats are aggregate only — no individual member data returned |

---

### BE-04: Role Management API

**User Story**:
> As an admin, I want to directly manage role-permission mappings through the API, so I can adjust access control without modifying the database manually.

**New Endpoints**:

#### `GET /api/admin/servers/:serverId/roles/:roleId/permissions`
Get all permissions assigned to a role.

**Auth**: Bearer Token (Admin only)

**Response (200)**:
```json
{
  "roleId": "string",
  "roleName": "string",
  "serverId": "string",
  "permissions": [
    { "id": "integer", "key": "string", "description": "string" }
  ]
}
```

---

#### `POST /api/admin/servers/:serverId/roles/:roleId/permissions`
Add permissions to a role.

**Auth**: Bearer Token (Admin only)

**Request Body**:
```json
{
  "permissionIds": ["integer"]
}
```

**Response (200)**: Updated permissions list

---

#### `DELETE /api/admin/servers/:serverId/roles/:roleId/permissions/:permissionId`
Remove a permission from a role.

**Auth**: Bearer Token (Admin only)

**Response (204)**: No content

---

#### `GET /api/admin/servers/:serverId/roles/:roleId/impact`
Preview how many members would be affected by a permission change.

**Auth**: Bearer Token (Admin only)

**Request Body**:
```json
{
  "permissionIds": ["integer"],
  "action": "add | remove"
}
```

**Response (200)**:
```json
{
  "affectedMembers": "integer",
  "memberIds": ["string"],
  "roleHolders": "integer"
}
```

---

**Module Structure**:
Extends existing `permissions` module with new controller methods.

```
src/modules/permissions/
├── permissions.controller.ts        ← Add new admin endpoints
├── permissions.service.ts           ← Add role-permission management methods
├── permissions.repository.ts        ← Add role-permission CRUD
└── dto/
    ├── assign-permissions.dto.ts    ← New
    └── impact-preview.dto.ts        ← New
```

**Acceptance Criteria**:
- [ ] Changes take effect immediately (cache invalidated)
- [ ] Executive role protected from permission removal (check `is_global` + hierarchy)
- [ ] Impact preview returns accurate count
- [ ] Permission cache invalidated on change
- [ ] All endpoints documented in Swagger

**Testing Requirements**:
- [ ] Unit test for role-permission CRUD
- [ ] Unit test for executive role protection
- [ ] Integration test for permission assignment
- [ ] Integration test for impact preview

**Dependencies**: Existing database schema (`role_permissions` table already exists)

**Security Rules**:
| Rule | Enforcement |
|---|---|
| Executive role protection | Roles with `is_global=true` or highest `hierarchy_level` cannot have permissions removed |
| Permission cache invalidation | In-memory + Redis cache cleared on every role-permission change |
| Impact preview read-only | Does not modify any data — only computes affected members |
| Admin-only access | All endpoints require Bearer token + admin role |

---

### BE-05: Audit Logging Enhancement

**User Story**:
> As a club admin, I want a comprehensive audit trail of all system actions, so I can troubleshoot issues, track changes, and ensure security compliance.

**New Endpoints**:

#### `GET /api/admin/audit/logs`
Get audit logs with filtering.

**Auth**: Bearer Token (Admin only)

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| dateFrom | string | 7 days ago | ISO 8601 |
| dateTo | string | now | ISO 8601 |
| actorId | string | — | Filter by admin |
| actionType | string | — | auth, project, server, role, webhook, member |
| severity | string | — | info, warning, error |
| limit | integer | 50 | Max 100 |
| offset | integer | 0 | Pagination |

**Response (200)**:
```json
{
  "logs": [
    {
      "id": "integer",
      "timestamp": "ISO 8601",
      "actorId": "string | null",
      "actorName": "string | null",
      "actionType": "string",
      "action": "string",
      "entityType": "string",
      "entityId": "string | null",
      "details": "object | null",
      "ipAddress": "string | null",
      "severity": "string"
    }
  ],
  "total": "integer",
  "limit": "integer",
  "offset": "integer"
}
```

---

#### `GET /api/admin/audit/logs/export`
Export audit logs.

**Auth**: Bearer Token (Admin only)

**Query Parameters**: Same as `GET /api/admin/audit/logs`

**Response**: CSV file download

---

#### `GET /api/admin/monitoring/health`
Get system health status.

**Auth**: Bearer Token (Admin only)

**Response (200)**:
```json
{
  "api": { "status": "healthy", "uptime": "integer", "responseTime": "integer" },
  "discord": { "status": "connected | disconnected", "guilds": "integer", "latency": "integer" },
  "database": { "status": "connected", "queryTime": "integer", "connections": "integer" },
  "redis": { "status": "connected", "hitRate": "float", "memoryUsed": "string" }
}
```

---

#### `GET /api/admin/monitoring/usage`
Get API usage statistics.

**Auth**: Bearer Token (Admin only)

**Query Parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| period | string | 30d | 7d, 30d, 90d |
| projectId | string | — | Filter by project |

**Response (200)**:
```json
{
  "totalRequests": "integer",
  "byProject": [
    { "projectId": "string", "projectName": "string", "requests": "integer", "errors": "integer" }
  ],
  "byEndpoint": [
    { "endpoint": "string", "method": "string", "count": "integer", "avgResponseTime": "integer" }
  ],
  "errors": { "total": "integer", "byType": { "4xx": "integer", "5xx": "integer" } }
}
```

---

**Audit Logging Middleware**:
```
src/common/middleware/audit-logging.middleware.ts
```
- Intercepts all admin requests
- Logs: actor, action, entity, details, IP, timestamp
- Writes to `audit_logs` table asynchronously

**Events to Audit**:
| Category | Actions |
|---|---|
| auth | login, logout, login_failed, token_refresh, session_revoked |
| project | created, updated, deleted, key_generated, key_revoked, key_regenerated |
| server | registered, updated, enabled, disabled, deleted |
| role | permission_added, permission_removed, inheritance_rule_created |
| webhook | created, executed, updated, deleted |
| member | exported, manually_synced |
| sync | triggered, completed, failed |

**Module Structure**:
```
src/modules/audit/
├── audit.module.ts
├── audit.controller.ts
├── audit.service.ts
├── audit.repository.ts
└── middleware/
    └── audit-logging.middleware.ts
```

**Acceptance Criteria**:
- [ ] All critical actions logged with who/what/when/IP
- [ ] Audit logs retained for 90 days (scheduled cleanup job)
- [ ] Search endpoint supports date/user/action filters
- [ ] Export returns CSV with all fields
- [ ] Health endpoint checks all 4 services
- [ ] Usage stats aggregated from request middleware

**Testing Requirements**:
- [ ] Unit test for AuditLoggingMiddleware
- [ ] Unit test for AuditService
- [ ] Integration test for audit log query
- [ ] Integration test for health check
- [ ] Retention policy test (verify 90-day cleanup)

**Dependencies**: None

**Database Migration** (0013):
```sql
CREATE TYPE audit_action_type AS ENUM (
  'auth', 'project', 'server', 'role', 'webhook', 'member', 'sync', 'permission'
);

CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'error');

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id VARCHAR(255) REFERENCES members(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  action_type audit_action_type NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  severity audit_severity DEFAULT 'info' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
```

**Security Rules**:
| Rule | Enforcement |
|---|---|
| Audit logs immutable | No UPDATE or DELETE — only INSERT and scheduled cleanup |
| IP address retention | Purged after 90 days via scheduled job |
| Admin-only access | All audit endpoints require Bearer token + admin role |
| Async writes | Audit logging middleware writes asynchronously to avoid blocking requests |

---

### BE-06: Session Lifecycle Extensions

**User Story**:
> As a club member using multiple MicroClub apps, I want my sessions to stay valid with automatic refresh, so I don't get logged out unexpectedly while working.

**Context**: The base session system already exists (creation, validation, logout, logout-all). This issue adds **refresh tokens, session introspection, and client metadata** on top of the existing `sessions` table and auth flow.

**New Endpoints**:

#### `POST /api/auth/token/refresh`
Refresh an expiring session token.

**Auth**: Valid session token (not yet expired)

**Request Body**:
```json
{
  "refreshToken": "string"
}
```

**Response (200)**:
```json
{
  "accessToken": "string",
  "expiresAt": "ISO 8601",
  "refreshToken": "string (new)"
}
```

---

#### `GET /api/auth/sessions`
List active sessions for the current member.

**Auth**: Valid session token

**Response (200)**:
```json
{
  "sessions": [
    {
      "id": "string",
      "projectId": "string | null",
      "serverId": "string | null",
      "createdAt": "ISO 8601",
      "expiresAt": "ISO 8601",
      "clientInfo": { "userAgent": "string", "ipAddress": "string" } | null
    }
  ]
}
```

---

#### `DELETE /api/auth/sessions/:sessionId`
Revoke a specific session.

**Auth**: Valid session token

**Response (204)**: No content

---

**Database Migration** (0014):
```sql
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS client_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS client_ip_address VARCHAR(45);

CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
```

**Security Rules**:
| Rule | Enforcement |
|---|---|
| Refresh token rotation | New refresh token issued on every refresh — old one invalidated |
| Refresh token hash | Stored as SHA-256 hash, never stored in plaintext |
| Session revocation | Immediate — token removed from DB, next request fails |
| Client metadata capture | IP and userAgent captured on session creation, used for session listing |

**Acceptance Criteria**:
- [ ] Refresh tokens renew sessions without re-auth
- [ ] Members can view active sessions
- [ ] Revocation works immediately
- [ ] Client metadata captured on session creation
- [ ] Refresh token rotation (new refresh token issued on each refresh)

**Testing Requirements**:
- [ ] Unit test for refresh token generation/validation
- [ ] Integration test for session listing
- [ ] Integration test for session revocation

**Dependencies**: None (extends existing `sessions` table)

---

### BE-07: Single Sign-On (SSO) Across Projects

**User Story**:
> As a club member, I want to log in once with Discord and be automatically authenticated across all MicroClub projects, so I don't have to re-authorize every time I switch between apps.

**Context**: Currently sessions are project-scoped — a user who logs into Project A must go through Discord OAuth again when visiting Project B. SSO introduces a **global browser session** (httpOnly cookie) that MCDI recognizes across all projects, skipping the Discord redirect if the user is already authenticated.

**How It Works**:

```
Browser → Project A → MCDI /api/auth/authorize
  → MCDI checks for global session cookie
  → No cookie found → redirect to Discord OAuth
  → Discord callback → create global session cookie + project session
  → Redirect back to Project A with callback code

Browser → Project B → MCDI /api/auth/authorize
  → MCDI checks for global session cookie
  → Cookie found and valid → skip Discord OAuth
  → Create project session for Project B
  → Redirect back to Project B with callback code (instant)
```

**Existing Flow (no SSO)**:
```
Every project → Discord OAuth → MCDI callback → Project
```

**New Flow (with SSO)**:
```
First project → Discord OAuth → Global session created → Project
Other projects → Global session check → Instant redirect → Project
```

**New Endpoints**:

#### `GET /api/auth/sso/session`
Check if a global SSO session exists for the current browser.

**Auth**: httpOnly SSO cookie

**Response (200)**:
```json
{
  "authenticated": true,
  "member": {
    "id": "string",
    "discordId": "string",
    "username": "string",
    "avatar": "string | null"
  },
  "expiresAt": "ISO 8601"
}
```

**Response (401)**:
```json
{
  "authenticated": false
}
```

---

#### `GET /api/auth/sso/authorize`
Initiate SSO-aware authorization. Replaces the current `/api/auth/authorize` flow with an SSO check first.

**Query Parameters**:
| Param | Type | Description |
|---|---|---|
| client_id | string | Project ID |
| redirect_uri | string | Project's callback URL |
| server_id | string | Discord server to check membership against |
| state | string | CSRF state from the project |

**Behavior**:
1. Check for valid SSO cookie
2. If cookie exists and valid → skip Discord OAuth, create project session, redirect with callback code
3. If cookie missing/expired → redirect to Discord OAuth (existing flow)

**Response**: 302 redirect (either to Discord OAuth or back to project with callback code)

---

#### `POST /api/auth/sso/logout`
Destroy the global SSO session (logs out from all projects).

**Auth**: httpOnly SSO cookie

**Response (204)**: No content

**Side effects**:
- Destroys the global SSO session
- Destroys ALL project sessions for this member
- Clears the httpOnly cookie

---

#### `GET /api/auth/sso/sessions`
List all active project sessions under the current SSO session.

**Auth**: httpOnly SSO cookie

**Response (200)**:
```json
{
  "sessions": [
    {
      "projectId": "string",
      "projectName": "string",
      "serverId": "string",
      "createdAt": "ISO 8601",
      "expiresAt": "ISO 8601",
      "lastUsedAt": "ISO 8601"
    }
  ]
}
```

---

**Database Migration** (0016):
```sql
CREATE TABLE sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id VARCHAR(255) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_sso_sessions_member_id ON sso_sessions(member_id);
CREATE INDEX idx_sso_sessions_token_hash ON sso_sessions(token_hash);
CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions(expires_at);
```

**Cookie Configuration**:
| Property | Value | Notes |
|---|---|---|
| Name | `mcdi_sso` | |
| httpOnly | true | Not accessible via JavaScript |
| secure | true | HTTPS only (false in dev) |
| sameSite | lax | CSRF protection |
| domain | `.microclub.dz` (configurable) | Shared across all project subdomains |
| path | `/` | |
| maxAge | 2592000 (30 days) | Matches session TTL |

**Security Rules**:
| Rule | Enforcement |
|---|---|
| SSO token hash only | Stored as SHA-256, never plaintext |
| httpOnly cookie | JavaScript cannot read or tamper with it |
| Secure flag | Only sent over HTTPS in production |
| sameSite=lax | CSRF protection — cookie sent on top-level navigation only |
| Domain-scoped | Configurable via `SSO_COOKIE_DOMAIN` env var |
| SSO logout cascades | Destroys all project sessions for the member |
| Backward compatible | Existing `/api/auth/authorize` flow unchanged |

**Acceptance Criteria**:
- [ ] First project login creates SSO cookie + project session
- [ ] Second project login skips Discord OAuth, uses SSO cookie
- [ ] SSO cookie is httpOnly, secure, sameSite=lax
- [ ] Expired SSO cookie falls back to Discord OAuth
- [ ] SSO logout destroys all project sessions
- [ ] SSO session listing shows all active project sessions
- [ ] Cookie domain is configurable via env var
- [ ] Backward compatible — existing `/api/auth/authorize` still works

**Testing Requirements**:
- [ ] Unit test for SSO session creation/validation
- [ ] Unit test for SSO cookie configuration
- [ ] Integration test for cross-project SSO flow
- [ ] E2E test: login Project A → visit Project B → instant auth
- [ ] E2E test: SSO logout → all projects logged out

**Dependencies**: BE-06 (Session Lifecycle Extensions — uses session listing)

---

## 5. Testing Strategy

### 5.1 Test Pyramid

```
        ┌─────────┐
        │  E2E    │  ~10% — Critical user flows
        ├─────────┤
        │Integration│ ~30% — API endpoints, service interactions
        ├─────────┤
        │  Unit   │  ~60% — Components, services, utilities
        └─────────┘
```

### 5.2 Frontend Testing

| Type | Tool | Coverage Target |
|---|---|---|
| Unit | Jest + React Testing Library | 80%+ |
| Integration | Jest + MSW (API mocking) | Key flows |
| E2E | Playwright | Critical paths |
| Visual | Chromatic / Storybook | Key components |

**Critical E2E Flows**:
1. Admin login → Dashboard → View servers → Add server
2. Create project → Reveal API key → Configure server access
3. Search members → Apply filters → Export to CSV
4. Assign permissions to role → Verify impact preview
5. Trigger sync → Monitor progress → View change details
6. Send message to Discord channel → Verify in Discord
7. Create webhook → Execute webhook → Verify message
8. Login Project A → visit Project B → instant SSO auth

### 5.3 Backend Testing

| Type | Tool | Coverage Target |
|---|---|---|
| Unit | Jest | 90%+ |
| Integration | Jest + Supertest | All endpoints |
| E2E | Jest + Supertest + Test containers | Critical flows |

**Required Test Categories**:
- DTO validation (valid and invalid inputs)
- Guard behavior (authorized/unauthorized)
- Service logic (CRUD, calculations)
- Error handling (4xx, 5xx responses)
- Rate limiting (verify limits enforced)
- Cache behavior (hit/miss/invalidation)

### 5.4 Performance Testing

| Metric | Target |
|---|---|
| API response time (existing endpoints) | < 200ms p95 |
| API response time (new endpoints) | < 300ms p95 |
| Frontend LCP | < 2.5s |
| Frontend FID | < 100ms |
| Frontend CLS | < 0.1 |

---

## 6. Dependencies Graph

### 8.1 Issue Dependency Map

```
FE-01 (Project Setup)
  ├── FE-02 (Auth UI)
  │     ├── FE-03 (Dashboard Layout)
  │     │     ├── FE-04 (Server Management)
  │     │     │     └── FE-05 (Project Management)
  │     │     ├── FE-06 (Member Management)
  │     │     │     └── FE-07 (Member Statistics) ← needs BE-03
  │     │     ├── FE-08 (Role Management) ← needs BE-04
  │     │     ├── FE-09 (Sync Management)
  │     │     ├── FE-10 (Channel Operations) ← needs BE-01
  │     │     ├── FE-11 (Webhook Management) ← needs BE-02
  │     │     ├── FE-12 (Monitoring) ← needs BE-05
  │     │     └── FE-13 (Settings)
  │     └── FE-14 (Responsive) ← all FE issues
  │
BE-01 (Channel API)
  └── BE-02 (Webhook API)

BE-03 (Stats API) — independent
BE-04 (Role API) — independent
BE-05 (Audit) — independent
BE-06 (Sessions) — independent
BE-07 (SSO) — depends on BE-06
```

### 8.2 Blocking Dependencies

| Issue | Blocked By |
|---|---|
| FE-02 | FE-01 |
| FE-03 | FE-02 |
| FE-04 | FE-03 |
| FE-05 | FE-03, FE-04 |
| FE-07 | BE-03 |
| FE-08 | BE-04 |
| FE-10 | BE-01 |
| FE-11 | BE-02 |
| FE-12 | BE-05 |
| BE-02 | BE-01 (shared channel access logic) |
| BE-07 | BE-06 |
| FE-12 | BE-05 |
| BE-02 | BE-01 (shared channel access logic) |

---

## 7. Migration Plan (EJS → New Frontend)

### Phase 1: Parallel Run
- New frontend deployed alongside existing EJS admin panel
- Both point to the same backend API
- EJS panel remains accessible at `/admin` (legacy)
- New frontend at `/app` or separate subdomain

### Phase 2: Feature Parity
- All EJS features replicated in new frontend:
  - Admin login via Discord OAuth
  - Project creation form
  - API key management
  - Quick links to Swagger docs

### Phase 3: Cutover
- Redirect `/admin` to new frontend
- Keep EJS templates as fallback for 30 days
- Remove EJS templates after verification period

### Phase 4: Cleanup
- Delete EJS view files
- Remove EJS-related routes from backend
- Update documentation

---

## 8. Environment Variables

### New Variables for V2

| Variable | Description | Default | Required |
|---|---|---|---|
| `ADMIN_FRONTEND_URL` | URL of the new frontend app | `http://localhost:3001` | Yes |
| `WEBHOOK_ENCRYPTION_KEY` | AES-256 key for webhook URL encryption | — | Yes |
| `MAX_WEBHOOKS_PER_PROJECT` | Max webhooks per project | `10` | No |
| `AUDIT_LOG_RETENTION_DAYS` | Days to retain audit logs | `90` | No |
| `MESSAGE_RATE_LIMIT` | Messages per minute per project | `5` | No |
| `STATS_CACHE_TTL_MS` | Stats API cache TTL | `300000` (5 min) | No |
| `HEALTH_CHECK_INTERVAL_MS` | Health check polling interval | `60000` (1 min) | No |

### Frontend Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3000/api` |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | Discord OAuth client ID | `1234567890` |

---

## 9. Error Response Standard

All API errors follow this format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "INVALID_CONTENT",
  "message": "Content exceeds maximum length of 2000 characters",
  "details": [
    {
      "field": "content",
      "constraint": "maxLength",
      "value": "..."
    }
  ],
  "timestamp": "2026-03-31T12:00:00.000Z",
  "path": "/api/servers/123/channels/456/messages"
}
```

### Standard Error Codes

| Code | Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `DISCORD_API_ERROR` | 502 | Discord API returned error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `NO_SEND_PERMISSION` | 403 | Project lacks SEND_MESSAGES operation |
| `NO_WEBHOOK_PERMISSION` | 403 | Project lacks MANAGE_WEBHOOKS operation |
| `CHANNEL_NOT_FOUND` | 404 | Channel does not exist |
| `WEBHOOK_NOT_FOUND` | 404 | Webhook not found or not owned by project |
| `WEBHOOK_LIMIT_REACHED` | 400 | Max webhooks per project reached |

---

## 10. Issue Templates

### 12.1 Frontend Issue Template

```markdown
## Type
Frontend

## Feature
FE-XX: [Feature Name]

## User Story
> As a [role], I want [capability], so [benefit].

## Description
[Detailed description of what needs to be built]

## Components
| Component | Purpose | Props |
|---|---|---|
| ComponentName | What it does | prop1, prop2 |

## API Calls
```
METHOD /api/endpoint → Purpose
```

## UI States
| State | Display |
|---|---|
| Loading | ... |
| Empty | ... |
| Error | ... |

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Testing
- [ ] Unit test for ComponentA
- [ ] E2E test for FlowB

## Dependencies
- Blocked by: #issue-number
- Blocks: #issue-number

## Design Notes
[Any Figma links, screenshots, or design specifications]
```

### 12.2 Backend Issue Template

```markdown
## Type
Backend

## Feature
BE-XX: [Feature Name]

## User Story
> As a [role], I want [capability], so [benefit].

## Description
[Detailed description of what needs to be built]

## New Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/... | API Key | ... |

## Request/Response Contracts
[Include DTOs and response schemas]

## Database Changes
- [ ] New table: table_name
- [ ] Migration file: 00XX_description.ts

## Module Structure
```
src/modules/module_name/
├── ...
```

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Swagger documentation updated
- [ ] Rate limits configured

## Testing
- [ ] Unit test for ServiceA
- [ ] Integration test for EndpointB
- [ ] Rate limit test

## Dependencies
- Blocked by: #issue-number
- Blocks: #issue-number

## Security Considerations
[Permission checks, rate limits, data protection]
```

---

## Appendix A: Recommended Sprint Breakdown

### Sprint 1 (Week 1-2): Foundation
| Issue | Assignee | Points |
|---|---|---|
| FE-01: Frontend Setup | Frontend Lead | 5 |
| BE-01: Channel Operations API | Backend Lead | 8 |
| BE-02: Webhook Management API | Backend Lead | 8 |
| Migration 0012: Webhooks Table | Backend Lead | 3 |

### Sprint 2 (Week 3-4): Core Admin Features
| Issue | Assignee | Points |
|---|---|---|
| FE-02: Authentication UI | Frontend Lead | 5 |
| FE-03: Dashboard Layout | Frontend Lead | 5 |
| FE-04: Server Management UI | Frontend Dev | 8 |
| FE-05: Project Management UI | Frontend Dev | 8 |
| BE-03: Member Statistics API | Backend Dev | 5 |

### Sprint 3 (Week 5-6): Member & Role Management
| Issue | Assignee | Points |
|---|---|---|
| FE-06: Member Management UI | Frontend Dev | 8 |
| FE-07: Member Statistics Dashboard | Frontend Dev | 5 |
| FE-08: Role & Permission Management UI | Frontend Dev | 8 |
| BE-04: Role Management API | Backend Dev | 5 |

### Sprint 4 (Week 7-8): Operations & Monitoring
| Issue | Assignee | Points |
|---|---|---|
| FE-09: Sync Management UI | Frontend Dev | 5 |
| FE-10: Channel Operations UI | Frontend Dev | 8 |
| FE-11: Webhook Management UI | Frontend Dev | 5 |
| BE-05: Audit Logging Enhancement | Backend Dev | 8 |
| Migration 0013: Audit Logs Table | Backend Dev | 3 |

### Sprint 5 (Week 9-10): Polish & Hardening
| Issue | Assignee | Points |
|---|---|---|
| FE-12: System Monitoring UI | Frontend Dev | 5 |
| FE-13: Settings UI | Frontend Dev | 3 |
| FE-14: Responsive Design | Frontend Dev | 5 |
| BE-06: Session Extensions | Backend Dev | 5 |
| BE-07: Single Sign-On (SSO) | Backend Lead | 8 |
| Migration 0014: Sessions Extension | Backend Dev | 2 |
| Migration 0016: SSO Sessions Table | Backend Dev | 2 |
| E2E Test Suite | QA / Full Team | 8 |

**Total Story Points**: ~135 points across 5 sprints

---

## Appendix B: Tech Stack Summary

### Frontend
| Category | Technology | Version |
|---|---|---|
| Framework | Next.js 15 (App Router) | 15.x |
| Language | TypeScript | 5.x |
| Styling | TailwindCSS + shadcn/ui | Latest |
| State | TanStack Query | 5.x |
| Forms | React Hook Form + Zod | Latest |
| Charts | Recharts | 2.x |
| Tables | TanStack Table | 8.x |
| Icons | Lucide React | Latest |
| Testing | Jest + Playwright | Latest |
| Package Manager | pnpm | 10.x |

### Backend (Additions)
| Category | Technology | Version |
|---|---|---|
| Framework | NestJS (existing) | 11.x |
| Database | PostgreSQL (existing) | 16+ |
| Cache | Redis (existing) | Latest |
| ORM | Drizzle ORM (existing) | 0.45+ |
| Validation | class-validator (existing) | Latest |
| Docs | Swagger (existing) | Latest |
| Testing | Jest + Supertest (existing) | Latest |

---

## Appendix C: Glossary

| Term | Definition |
|---|---|
| MCDI | MicroClub Discord Interface |
| Project | A MicroClub application integrated with MCDI |
| Server | A Discord guild managed by MCDI |
| Scope | API permission level (read_members, check_permissions) |
| Operation | Server-level action permission (READ, SEND_MESSAGES, MANAGE_WEBHOOKS) |
| Club Member | A Discord user who is a member of the main MicroClub server |
| System Admin | A Discord user with the configured admin role in the main guild |
