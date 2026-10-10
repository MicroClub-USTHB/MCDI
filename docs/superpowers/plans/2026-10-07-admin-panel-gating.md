# Admin Panel Gating Implementation Plan (PR 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every query, section and action of the admin panel follow the signed-in member's access levels: queries the member cannot make are not sent, sections of mixed pages degrade, write and manage actions are hidden below the member's level, and the settings page follows the permission system part by part.

**Architecture:** every query hook calls `useCan(resource, 'read')` into its `enabled`; views wrap sections and actions in `<Can>` or check `useCan`; leaf components (tables, forms) call `useCan` themselves so no prop plumbing is needed; forms the member can read but not change are rendered read-only.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Zustand, TanStack Query v5, Tailwind v4, Vitest + React Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-10-07-admin-panel-access-design.md` (Part 1). It builds on `docs/superpowers/plans/2026-10-07-admin-panel-foundations.md` (PR 1, merged first): the rules library, `useCan`, `<Can>`, the route table and the test helpers all come from there.

## Global Constraints

- The panel never enforces anything. The API is the only enforcement. The panel adapts to it, and the session cookie belongs to the API origin, so Next cannot read it. `proxy.ts` is not changed.
- Levels are `none < read < write < manage` and cumulative. Root passes every requirement (its `permissions` are `manage` throughout).
- Buttons and actions below the member's level are **hidden**, not disabled. A form the member can read but not change is rendered read-only with a "Read only" badge.
- A route with no entry in the route table is **denied**. A test fails when a `page.tsx` under `app/dashboard` has no entry.
- A query the member cannot make is **not sent**: every query hook is `enabled` only when the member can read its resource.
- Secondary data (a filter, a picker, a label, an extra card) degrades silently when the member cannot read it. Primary data is required by the route table.
- `/dashboard/settings` is open to every signed-in admin. Its profile section is always available; every other section follows the rules in Task 7 of this plan.
- Inbound webhook submissions are governed by the webhook's reader roles, not by levels. Do not gate `useSubmissionsQuery` or `useSubmissionQuery`, and do not gate the Submissions tab.
- Keep the code conventions of `apps/web/CLAUDE.md`: named exports only (except Next.js pages and layouts), `import type` for type-only imports, no `any`, `cn()` for conditional classes, design tokens (no hardcoded colors, no `dark:` classes), `lucide-react` icons, `@/` alias, tests only under `apps/web/tests`.
- Do not change the data in `nav-items.ts` (the docs excerpt the project sub-item lines); derive visibility from the route table instead. If a docs excerpt test fails after an edit, update the excerpt in `apps/web/src/content/docs/build/web-guide.mdx` to match.
- The existing web tests must keep passing. `tests/setup.ts` signs a root user in by default (added in the foundations PR), so a test that needs an anonymous or limited user says so explicitly with `signInAs({ permissions })` or `signOut()` from `tests/helpers/auth.ts`.
- Commits and the PR carry no `Co-Authored-By` trailer and no Claude signature. Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`. The PR targets `dev`.
- Branch: `benabdou/admin-panel-gating`, created from the latest `origin/dev` after the foundations PR has merged.
- All commands run from the repository root `/Users/destockphonedz/Documents/MCDI/MCDI` unless a step says otherwise. Do not run `pnpm build` in a shell where `apps/api/.env` was sourced (it sets `NODE_ENV=development` and breaks `next build`). Run `pnpm exec prettier --write` and `pnpm exec eslint --fix` only on the files you changed.

## File Structure

| File | Responsibility |
|---|---|
| `*/api/queries.ts` of 11 features (modify) | Query hooks gated by `useCan` |
| About 25 views and components (modify) | Sections and actions gated |
| `apps/web/src/app/dashboard/settings/page.tsx` and the settings forms (modify) | The settings page, part by part |
| `apps/web/tests/features/**` (create) | Access tests per area |
| `apps/web/src/content/docs/build/web-guide.mdx`, `apps/web/CLAUDE.md`, `apps/web/AGENTS.md` (modify) | Document the rules |

---

### Task 1: Disable every query the member cannot make

**Files:**
- Modify: the `api/queries.ts` of 11 features (list below).
- Test: `apps/web/tests/features/access/query-gating.test.tsx`

**Interfaces:**
- Consumes: `useCan` (foundations PR).

The rule for every GET query hook: call `useCan(<resource>, 'read')` first, and AND it into `enabled` (add `enabled: allowed` when the hook has none, `enabled: allowed && (<existing>)` when it has). Example, `features/servers/api/queries.ts`:

```ts
import { useCan } from '@/shared/lib/use-access';

export function useServersQuery() {
  const allowed = useCan('servers', 'read');
  return useQuery({
    queryKey: serverKeys.list(),
    queryFn: async () => (await fetchServers()).data,
    enabled: allowed,
  });
}
```

(Keep each hook's real `queryKey`, `queryFn` and other options; only add the two lines.) Composite hooks (`useAllRoleOptions`, `useProjectRoleOptions`) call gated hooks and need no edit. Do **not** gate `useCurrentAdminQuery`, `useProfileQuery`, `useSubmissionsQuery`, `useSubmissionQuery`, or `useMemberPermissionsQueries` (that one calls an API-key endpoint and is a separate, existing problem).

| File | Hook | Resource |
|---|---|---|
| `features/servers/api/queries.ts` | `useServersQuery`, `useServerQuery` | `servers` |
| `features/members/api/queries.ts` | `useMembersQuery`, `useMemberQuery`, `useMemberServersQuery` | `members` |
| `features/members/api/queries.ts` | `useServerRolesQuery` | `stats` (it calls `/admin/stats/roles`) |
| `features/channels/api/queries.ts` | `useChannelsQuery`, `useChannelQuery` | `channels` |
| `features/channels/api/queries.ts` | `useMessageHistoryQuery` | `messages` |
| `features/roles/api/queries.ts` | `useRolePermissionsQuery`, `useImpactPreviewQuery`, `useInheritanceRulesQuery`, `useAllRolePermissionsQuery` | `roles` |
| `features/roles/api/queries.ts` | `useRoleStatsQuery` | `stats` |
| `features/stats/api/queries.ts` | `useMemberStatsQuery`, `useMemberGrowthQuery`, `useRoleStatsQuery`, `useServerStatsQuery` | `stats` |
| `features/sync/api/queries.ts` | `useSyncStatusAllQuery`, `useSyncStatusQuery`, `useSyncLogsQuery`, `useSyncChangesQuery` | `sync` |
| `features/projects/api/queries.ts` | `useProjectsQuery`, `useProjectQuery`, `useAccessMatrixQuery`, `useAccessAuditQuery` | `projects` |
| `features/projects/api/queries.ts` | `useApiKeyInfoQuery` | `project_keys` |
| `features/webhooks/api/queries.ts` | `useWebhooksQuery` | `webhooks` |
| `features/inbound-webhooks/api/queries.ts` | `useInboundWebhooksQuery`, `useAllowedRolesQuery`, `useInboundSettingsQuery`, `useSchemaPreviewQuery`, `useInboundWebhookQuery`, `useWebhookDocsQuery` | `inbound_webhooks` |
| `features/monitoring/api/queries.ts` | `useApiUsageQuery`, `useSystemHealthQuery`, `useAuthFailuresQuery` | `monitoring` |
| `features/monitoring/api/queries.ts` | `useAuditLogsQuery` | `audit` |
| `features/settings/api/queries.ts` | `useSettingsQuery` | `settings` |

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/access/query-gating.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { useAuditLogsQuery, useSystemHealthQuery } from '@/features/monitoring/api/queries';
import { useInboundSettingsQuery } from '@/features/inbound-webhooks/api/queries';
import { useProjectsQuery } from '@/features/projects/api/queries';
import { useServerStatsQuery } from '@/features/stats/api/queries';
import { useServersQuery } from '@/features/servers/api/queries';
import { useSettingsQuery } from '@/features/settings/api/queries';
import { useSyncStatusAllQuery } from '@/features/sync/api/queries';
import { useWebhooksQuery } from '@/features/webhooks/api/queries';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Each hook, the resource it needs, and an endpoint that answers when it is called. */
const CASES = [
  { name: 'useServersQuery', resource: 'servers', path: '/servers', run: () => useServersQuery() },
  { name: 'useProjectsQuery', resource: 'projects', path: '/admin/projects', run: () => useProjectsQuery() },
  { name: 'useServerStatsQuery', resource: 'stats', path: '/admin/stats/servers', run: () => useServerStatsQuery() },
  { name: 'useSyncStatusAllQuery', resource: 'sync', path: '/admin/sync/status/all', run: () => useSyncStatusAllQuery() },
  { name: 'useSettingsQuery', resource: 'settings', path: '/admin/settings', run: () => useSettingsQuery() },
  { name: 'useSystemHealthQuery', resource: 'monitoring', path: '/admin/monitoring/health', run: () => useSystemHealthQuery() },
  { name: 'useAuditLogsQuery', resource: 'audit', path: '/admin/audit/logs', run: () => useAuditLogsQuery(1, {}) },
  { name: 'useInboundSettingsQuery', resource: 'inbound_webhooks', path: '/admin/inbound-webhooks/settings', run: () => useInboundSettingsQuery() },
  { name: 'useWebhooksQuery', resource: 'webhooks', path: '/admin/projects/p1/webhooks', run: () => useWebhooksQuery('p1') },
] as const;

describe.each(CASES)('$name', ({ resource, path, run }) => {
  it(`sends no request without ${resource}:read`, async () => {
    let requested = false;
    server.use(
      http.get(`${API}${path}`, () => {
        requested = true;
        return HttpResponse.json({});
      })
    );
    signInAs({ permissions: {} });

    const { result } = renderHook(run, { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).toBe(false);
  });

  it(`fetches with ${resource}:read`, async () => {
    server.use(http.get(`${API}${path}`, () => HttpResponse.json({})));
    signInAs({ permissions: { [resource]: 'read' } });

    const { result } = renderHook(run, { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).not.toBe('idle'));
  });
});
```

(Adjust an import path or the hook's argument list if the real signature differs; the assertion is the same for every hook.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/query-gating.test.tsx`
Expected: the nine "sends no request" cases FAIL (the hooks fetch regardless).

- [ ] **Step 3: Gate the hooks**

Apply the rule above to every hook in the table, one file at a time. Add `import { useCan } from '@/shared/lib/use-access';` to each file.

- [ ] **Step 4: Run the gating test and the whole web suite**

Run: `pnpm --filter @mcdi/web exec vitest run`
Expected: PASS. The default root user (foundations PR) keeps every existing test fetching. Un-skip the sidebar test that the foundations PR left skipped (`does not ask for servers when the member cannot read them`, in `tests/shared/components/layout/sidebar.test.tsx`) and confirm it passes.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/features/access/query-gating.test.tsx
git add apps/web
git commit -m "feat(web): do not send queries the member cannot make"
```

---

### Task 2: Secondary data on the dashboard, statistics, monitoring and members pages

**Files:**
- Modify: `apps/web/src/app/dashboard/quick-stats.tsx`, `apps/web/src/app/dashboard/stats/page.tsx`, `apps/web/src/app/dashboard/monitoring/page.tsx`, `apps/web/src/features/monitoring/components/AuditLogFilters.tsx`, `apps/web/src/features/members/components/MemberFilters.tsx`
- Test: `apps/web/tests/app/dashboard/quick-stats.test.tsx`, `apps/web/tests/features/monitoring/…` (new `tests/app/dashboard/monitoring-access.test.tsx`), `apps/web/tests/features/members/components/member-filters-access.test.tsx`

**Interfaces:**
- Consumes: `useCan`, `Can`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/tests/app/dashboard/quick-stats.test.tsx` (the file already mocks the four feature hooks or MSW endpoints; reuse its setup; if it mocks `@/features/...` hooks, mock them the same way here):

```tsx
  it('shows only the cards the member can read, and a pointer when there are none', () => {
    signInAs({ permissions: { servers: 'read' } });
    render(<QuickStats />, { wrapper });

    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
    expect(screen.queryByText('Sync')).not.toBeInTheDocument();
  });

  it('points at the sidebar when no card applies', () => {
    signInAs({ permissions: { messages: 'read' } });
    render(<QuickStats />, { wrapper });

    expect(screen.getByText(/pick a page from the sidebar/i)).toBeInTheDocument();
  });
```

Create `apps/web/tests/app/dashboard/monitoring-access.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import MonitoringPage from '@/app/dashboard/monitoring/page';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('MonitoringPage access', () => {
  it('shows only the audit log to a member who can read audit but not monitoring', () => {
    server.use(http.get(`${API}/admin/audit/logs`, () => HttpResponse.json({ logs: [], total: 0, limit: 50 })));
    signInAs({ permissions: { audit: 'read' } });
    render(<MonitoringPage />, { wrapper });

    expect(screen.getByRole('heading', { name: 'Audit logs' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'System health' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'API usage' })).not.toBeInTheDocument();
  });

  it('shows everything except the audit log to a member who can read monitoring only', () => {
    signInAs({ permissions: { monitoring: 'read' } });
    render(<MonitoringPage />, { wrapper });

    expect(screen.getByRole('heading', { name: 'System health' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Audit logs' })).not.toBeInTheDocument();
  });

  it('hides the actor filter without members:read', () => {
    signInAs({ permissions: { audit: 'read' } });
    render(<MonitoringPage />, { wrapper });
    expect(screen.queryByText('Actor')).not.toBeInTheDocument();
  });
});
```

Create `apps/web/tests/features/members/components/member-filters-access.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { signInAs } from '../../../helpers/auth';
import { MemberFilters } from '@/features/members/components/MemberFilters';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const filters = { search: '', serverIds: [], roleIds: [], filter: 'all', page: 1, pageSize: 20 } as never;

function renderFilters() {
  return render(
    <MemberFilters filters={filters} onFilterChange={vi.fn()} onClearFilters={vi.fn()} />,
    { wrapper }
  );
}

describe('MemberFilters access', () => {
  it('hides the server filter without servers:read and the role filter without stats:read', () => {
    signInAs({ permissions: { members: 'read' } });
    renderFilters();

    expect(screen.queryByText('Servers')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
    expect(screen.getByText('Club')).toBeInTheDocument();
  });

  it('shows the server filter with servers:read, and the role filter only with stats:read too', () => {
    signInAs({ permissions: { members: 'read', servers: 'read' } });
    const { unmount } = renderFilters();
    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
    unmount();

    signInAs({ permissions: { members: 'read', servers: 'read', stats: 'read' } });
    renderFilters();
    expect(screen.getByText('Roles')).toBeInTheDocument();
  });
});
```

(Adjust `filters` to the real `MemberFilters` type of the file if `as never` hides a required field the component reads.)

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/app/dashboard/quick-stats.test.tsx tests/app/dashboard/monitoring-access.test.tsx tests/features/members/components/member-filters-access.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Dashboard cards**

In `apps/web/src/app/dashboard/quick-stats.tsx`, add `import { EmptyState } from '@/shared/components/ui/empty-state';` and `import { useCan } from '@/shared/lib/use-access';` and replace `QuickStats` with:

```tsx
function QuickStats() {
  const canServers = useCan('servers', 'read');
  const canProjects = useCan('projects', 'read');
  const canStats = useCan('stats', 'read');
  const canSync = useCan('sync', 'read');

  if (!canServers && !canProjects && !canStats && !canSync) {
    return (
      <EmptyState
        title="Nothing to summarize here"
        description="Pick a page from the sidebar to see what you have access to."
      />
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-live="polite"
      aria-atomic="false"
    >
      {canServers ? <ServersStatCard /> : null}
      {canProjects ? <ProjectsStatCard /> : null}
      {canStats ? <MembersStatCard /> : null}
      {canSync ? <SyncStatusStatCard /> : null}
    </div>
  );
}
```

- [ ] **Step 4: Statistics page server filter**

In `apps/web/src/app/dashboard/stats/page.tsx`, add `import { useCan } from '@/shared/lib/use-access';`, add `const canServers = useCan('servers', 'read');` after `const serversQuery = useServersQuery();`, and wrap the `<select aria-label="Server" ...> ... </select>` and the `{serversQuery.isError ? ( ... ) : null}` block that follows it in `{canServers ? (<> ... </>) : null}`.

- [ ] **Step 5: Monitoring page**

In `apps/web/src/app/dashboard/monitoring/page.tsx`, add `import { useCan } from '@/shared/lib/use-access';` and, after the existing hook calls, add:

```tsx
  const canMonitoring = useCan('monitoring', 'read');
  const canAudit = useCan('audit', 'read');
  const canProjects = useCan('projects', 'read');
  const canMembers = useCan('members', 'read');
```

Wrap, in `{canMonitoring ? ( ... ) : null}`, the three sections `System health` (`<section aria-labelledby="health-heading"`), `API usage` (`usage-heading`) and `Recent authentication failures` (`failures-heading`). Wrap the whole `Audit logs` section (`<section aria-labelledby="audit-heading"`) in `{canAudit ? ( ... ) : null}`. Wrap the project filter `<label className="flex items-center gap-2 text-overline text-text-muted"> Project ... </label>` in `{canProjects ? ( ... ) : null}`. Change the `AuditLogFilters` usage to:

```tsx
        <AuditLogFilters
          filters={auditFilters}
          onChange={updateAuditFilters}
          actors={membersQuery.data?.data ?? []}
          showActorFilter={canMembers}
        />
```

The header "requests" badge and the service-down alert stay: they read gated queries and render nothing without data.

In `apps/web/src/features/monitoring/components/AuditLogFilters.tsx`, add `showActorFilter?: boolean;` to `AuditLogFiltersProps` (default `true` in the destructuring: `showActorFilter = true`) and wrap the Actor label (the block that renders `<span>Actor</span>` and its `<select>`) in `{showActorFilter ? ( ... ) : null}`.

- [ ] **Step 6: Member filters**

In `apps/web/src/features/members/components/MemberFilters.tsx`, add `import { useCan } from '@/shared/lib/use-access';`, and in `MemberFilters` after the `const { data: servers = [], ... } = useServersQuery();` line add:

```tsx
  const canServers = useCan('servers', 'read');
  const canRoleStats = useCan('stats', 'read');
```

Change `const roleQueries = useQueries({ queries: memberRoleQueries(filters.serverIds) });` to

```tsx
  const roleQueries = useQueries({
    queries: memberRoleQueries(canRoleStats ? filters.serverIds : []),
  });
```

Change `{!lockServer && (` (the Servers block) to `{!lockServer && canServers && (`. Wrap the Roles block (`<div className="min-w-0 space-y-1"> <span ...>Roles</span> ... </div>`) in `{canServers && canRoleStats ? ( ... ) : null}`.

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/app/dashboard tests/features/members tests/features/monitoring tests/features/stats`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/app/dashboard/monitoring-access.test.tsx apps/web/tests/features/members/components/member-filters-access.test.tsx
git add apps/web
git commit -m "feat(web): degrade secondary data on the dashboard, stats, monitoring and members pages"
```

---

### Task 3: Servers and sync actions

**Files:**
- Modify: `apps/web/src/app/dashboard/servers/servers-view.tsx`, `apps/web/src/app/dashboard/servers/[id]/server-detail-view.tsx`, `apps/web/src/app/dashboard/servers/[id]/sync/sync-view.tsx`, `apps/web/src/features/servers/components/ServerTable/ServerTable.tsx`, `apps/web/src/features/servers/components/ServerForm/ServerForm.tsx`
- Test: `apps/web/tests/features/servers/servers-access.test.tsx`

**Interfaces:**
- Consumes: `useCan`, `Can`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/servers/servers-access.test.tsx` (the render helpers and server fixtures mirror `tests/app/dashboard/server-members.test.tsx`; the fixture shape is the one in `sidebar.test.tsx` `serverDto`):

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/servers',
}));

import { ServersView } from '@/app/dashboard/servers/servers-view';

const API = 'http://localhost:3000/api';

const serverDto = {
  id: 'srv_1',
  name: 'MicroClub',
  icon: null,
  type: 'club',
  isMain: false,
  isActive: true,
  syncFrequencyHours: 24,
  defaultPermissionPolicy: 'custom',
  disabledReason: null,
  syncedAt: null,
  lastSyncAt: null,
  botConnected: true,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function useServers() {
  server.use(
    http.get(`${API}/servers`, () => HttpResponse.json([serverDto])),
    http.get(`${API}/admin/sync/status/all`, () => HttpResponse.json([]))
  );
}

describe('Servers list actions', () => {
  it('shows no write or manage action to a read-only member', async () => {
    useServers();
    signInAs({ permissions: { servers: 'read' } });
    render(<ServersView />, { wrapper });

    await screen.findByText('MicroClub');
    expect(screen.queryByRole('button', { name: /add server/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync all servers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('lets a writer add, disable and sync but not delete', async () => {
    useServers();
    signInAs({ permissions: { servers: 'write', sync: 'write' } });
    render(<ServersView />, { wrapper });

    await screen.findByText('MicroClub');
    expect(screen.getAllByRole('button', { name: /add server/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /sync all servers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('lets a manager delete', async () => {
    useServers();
    signInAs({ permissions: { servers: 'manage' } });
    render(<ServersView />, { wrapper });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/servers/servers-access.test.tsx`
Expected: FAIL (every action is shown).

- [ ] **Step 3: The server table**

In `apps/web/src/features/servers/components/ServerTable/ServerTable.tsx`:

- add `import { useCan } from '@/shared/lib/use-access';`
- change the builder signature and the actions column. Replace `function buildDefaultColumns(onAction: (action: ServerAction, server: ServerListItemDto) => void): ColumnDef<ServerListItemDto>[] {` with

```tsx
function buildDefaultColumns(
  onAction: (action: ServerAction, server: ServerListItemDto) => void,
  access: { canWrite: boolean; canManage: boolean }
): ColumnDef<ServerListItemDto>[] {
```

- in the actions cell, wrap the two buttons:

```tsx
            {access.canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAction(server.isActive ? 'disable' : 'enable', server)}
              >
                {server.isActive ? 'Disable' : 'Enable'}
              </Button>
            ) : null}
            {access.canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/12"
                onClick={() => onAction('delete', server)}
              >
                Delete
              </Button>
            ) : null}
```

- make the function return the columns without the actions column when neither is allowed: change the final `];` of the returned array into `].filter((column) => column.id !== 'actions' || access.canWrite || access.canManage);` (keep the array literal as the expression of `return`).
- in `ServerTable`, add `const canWrite = useCan('servers', 'write'); const canManage = useCan('servers', 'manage');` and change `columns ?? buildDefaultColumns(onAction)` to `columns ?? buildDefaultColumns(onAction, { canWrite, canManage })`.

- [ ] **Step 4: The server form**

In `apps/web/src/features/servers/components/ServerForm/ServerForm.tsx`:

- add `import { useCan } from '@/shared/lib/use-access';`
- at the top of `ServerForm` add `const canWrite = useCan('servers', 'write'); const readOnly = props.mode === 'edit' && !canWrite;`
- wrap the contents of the `<form ...>` in `<fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0"> ... </fieldset>` (keeping the form's own className), and hide the submit button when read only: replace the `<Button type="submit" ...>` element with `{readOnly ? <Badge variant="secondary">Read only</Badge> : (<Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">{props.mode === 'create' ? 'Add Server' : 'Save Changes'}</Button>)}` and add `import { Badge } from '@/shared/components/ui/badge';`.

- [ ] **Step 5: The views**

In `apps/web/src/app/dashboard/servers/servers-view.tsx`: add `import { Can } from '@/shared/components/common';` and `import { useCan } from '@/shared/lib/use-access';`; add `const canWrite = useCan('servers', 'write');` in `ServersView`; wrap `<SyncTriggerButton ... />` in `<Can resource="sync" level="write">...</Can>`; replace the two `<CreateServerButton onClick={() => setCreateOpen(true)} />` usages with `{canWrite ? <CreateServerButton onClick={() => setCreateOpen(true)} /> : null}` (the one inside the empty state becomes `action={hasActiveFilters ? ( ...clear button... ) : canWrite ? (<CreateServerButton onClick={() => setCreateOpen(true)} />) : undefined}`).

In `apps/web/src/app/dashboard/servers/[id]/server-detail-view.tsx`: add the same imports. Wrap the Disable/Enable `<Button>` in `<Can resource="servers" level="write">` and the Delete `<Button>` in `<Can resource="servers" level="manage">`. Wrap `<ServerStatsCard stats={stats} isLoading={isStatsPending} />` in `<Can resource="stats" level="read">`, and the `<ServerStatsCard stats={undefined} isLoading />` inside the loading skeleton the same way.

In `apps/web/src/app/dashboard/servers/[id]/sync/sync-view.tsx`: add `import { useCan } from '@/shared/lib/use-access';`, add `const canSync = useCan('sync', 'write');` and change `action={ <SyncTriggerButton ... /> }` to `action={canSync ? (<SyncTriggerButton ... />) : undefined}` (keep the button's props).

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/servers tests/features/sync tests/app/dashboard`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/features/servers/servers-access.test.tsx
git add apps/web
git commit -m "feat(web): gate server and sync actions by level"
```

---

### Task 4: Roles actions

**Files:**
- Modify: `apps/web/src/app/dashboard/servers/[id]/roles/roles-view.tsx`, `apps/web/src/app/dashboard/servers/[id]/roles/[roleId]/role-detail-view.tsx`, `apps/web/src/features/roles/components/PermissionMatrix.tsx`
- Test: `apps/web/tests/features/roles/roles-access.test.tsx`

**Interfaces:**
- Consumes: `useCan`.
- Produces: `PermissionMatrix` gains an optional `lockedIds?: Set<number>` prop (those permissions are disabled).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/roles/roles-access.test.tsx`. It reuses the fixtures and mocks of `tests/features/roles/roles-flow.test.tsx` and `role-detail-flow.test.tsx` (read both first and import or copy their MSW handlers for `/admin/stats/roles`, the permissions and the inheritance rules). The assertions:

```tsx
describe('Roles access', () => {
  it('hides "Add Inheritance Rule" without roles:write', async () => {
    // handlers as in roles-flow.test.tsx
    signInAs({ permissions: { servers: 'read', roles: 'read', stats: 'read' } });
    renderRolesView();
    await screen.findByText(/roles & permissions/i);
    expect(screen.queryByRole('button', { name: /add inheritance rule/i })).not.toBeInTheDocument();
  });

  it('shows it with roles:write', async () => {
    signInAs({ permissions: { servers: 'read', roles: 'write', stats: 'read' } });
    renderRolesView();
    expect(await screen.findByRole('button', { name: /add inheritance rule/i })).toBeInTheDocument();
  });

  it('locks every permission checkbox for a read-only member', async () => {
    signInAs({ permissions: { servers: 'read', roles: 'read', stats: 'read' } });
    renderRoleDetail();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes.every((box) => box.hasAttribute('disabled'))).toBe(true);
  });

  it('lets a writer add permissions but not remove the ones already granted', async () => {
    signInAs({ permissions: { servers: 'read', roles: 'write', stats: 'read' } });
    renderRoleDetail();
    const boxes = await screen.findAllByRole('checkbox');
    const granted = boxes.filter((box) => (box as HTMLInputElement).checked);
    const free = boxes.filter((box) => !(box as HTMLInputElement).checked);
    expect(granted.length).toBeGreaterThan(0);
    expect(granted.every((box) => box.hasAttribute('disabled'))).toBe(true);
    expect(free.every((box) => !box.hasAttribute('disabled'))).toBe(true);
  });

  it('lets a manager toggle everything', async () => {
    signInAs({ permissions: { servers: 'read', roles: 'manage', stats: 'read' } });
    renderRoleDetail();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes.every((box) => !box.hasAttribute('disabled'))).toBe(true);
  });
});
```

where `renderRolesView` renders `<RolesView serverId="srv_1" />` and `renderRoleDetail` renders `<RoleDetailView serverId="srv_1" roleId="role_1" />`, each inside a `QueryClientProvider` and with the mocked `next/navigation`, copied from the two existing flow tests.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/roles/roles-access.test.tsx`
Expected: FAIL.

- [ ] **Step 3: The permission matrix**

In `apps/web/src/features/roles/components/PermissionMatrix.tsx`: add `lockedIds?: Set<number>;` to `PermissionMatrixProps`, destructure `lockedIds`, and change `disabled={locked}` on `PermissionCheckbox` to `disabled={locked || (lockedIds?.has(perm.id) ?? false)}`.

- [ ] **Step 4: The role detail view**

In `role-detail-view.tsx`: add `import { useCan } from '@/shared/lib/use-access';`. In `RoleDetailView`, after the `toast` line add:

```tsx
  const canWrite = useCan('roles', 'write');
  const canManage = useCan('roles', 'manage');
```

Change `locked={isApplying || isExecutiveRole}` to `locked={isApplying || isExecutiveRole || !canWrite}` and add the prop

```tsx
                  lockedIds={canManage ? undefined : currentRolePerms.permissionIds}
```

to the `<PermissionMatrix ...>`. In `handleToggle`, change the first line to `if (isApplying || isExecutiveRole || !canWrite || !currentRolePerms) return;` and add, after `const currentlyHas = ...;`:

```tsx
    if (currentlyHas && !checked && !canManage) return;
```

- [ ] **Step 5: The roles view**

In `roles-view.tsx`: add `import { useCan } from '@/shared/lib/use-access';` and `const canWrite = useCan('roles', 'write');`. Change `{stats && stats.roles.length > 0 && (<Button ...>Add Inheritance Rule</Button>)}` to `{canWrite && stats && stats.roles.length > 0 && ( ... )}` and `{stats && (<InheritanceRuleForm ... />)}` to `{canWrite && stats && ( ... )}`.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/roles`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/features/roles/roles-access.test.tsx
git add apps/web
git commit -m "feat(web): gate role permission and inheritance actions by level"
```

---

### Task 5: Projects, API keys, server access and outbound webhooks

**Files:**
- Modify: `apps/web/src/app/dashboard/projects/projects-view.tsx`, `apps/web/src/app/dashboard/projects/[id]/project-detail-view.tsx`, `apps/web/src/app/dashboard/projects/[id]/access/access-view.tsx`, `apps/web/src/features/projects/components/ProjectTable.tsx`, `apps/web/src/features/projects/components/CreateProjectButton.tsx`, `apps/web/src/features/projects/components/ProjectForm.tsx`, `apps/web/src/features/projects/components/ServerAccessMatrix.tsx`, `apps/web/src/features/projects/components/ApiKeyDisplay.tsx`, `apps/web/src/features/projects/components/RedirectUriManager.tsx`, `apps/web/src/features/webhooks/components/WebhookDetail.tsx`
- Test: `apps/web/tests/features/projects/projects-access.test.tsx`

**Interfaces:**
- Consumes: `useCan`, `Can`.

The levels (from the actions table in the spec): create, edit, set the redirect URI, grant or change server access need `projects:write`; delete a project and revoke server access need `projects:manage`. The "Deactivate project" switch and table action call the key-revoke endpoint (`DELETE /admin/projects/:id/key`) and "Reactivate" calls restore-key, so they need `project_keys:manage` and `project_keys:write`. Regenerate needs `project_keys:write`; viewing the key panel needs `project_keys:read`. Deleting an outbound webhook needs `webhooks:manage`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/projects/projects-access.test.tsx` rendering `ProjectDetailView` with the project and API-key endpoints mocked (copy the handlers and render helper of `tests/app/dashboard/project-pages.test.tsx`), and asserting:

```tsx
describe('Project detail access', () => {
  it('shows a read-only member no edit, delete, key or redirect action', async () => {
    signInAs({ permissions: { projects: 'read', project_keys: 'read' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'Website' });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /deactivate project/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reveal|details/i })).toBeInTheDocument();
  });

  it('omits the API key panel without project_keys:read', async () => {
    signInAs({ permissions: { projects: 'read' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'Website' });
    expect(screen.queryByRole('heading', { name: 'API key' })).not.toBeInTheDocument();
  });

  it('gates each action by its own level', async () => {
    signInAs({ permissions: { projects: 'write', project_keys: 'write' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'Website' });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete project/i })).not.toBeInTheDocument();
    // Deactivating revokes the key (manage); the switch is not offered to a writer on an active project.
    expect(screen.queryByRole('switch', { name: /deactivate project/i })).not.toBeInTheDocument();
  });

  it('lets a manager of both delete and deactivate', async () => {
    signInAs({ permissions: { projects: 'manage', project_keys: 'manage' } });
    renderDetail();
    expect(await screen.findByRole('button', { name: /delete project/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /deactivate project/i })).toBeInTheDocument();
  });
});

describe('Projects list access', () => {
  it('hides Create project without projects:write', async () => {
    signInAs({ permissions: { projects: 'read' } });
    renderList();
    await screen.findByText('Website');
    expect(screen.queryByRole('button', { name: /create project/i })).not.toBeInTheDocument();
  });
});
```

(`renderDetail` renders `<ProjectDetailView id="proj_1" />` and `renderList` renders `<ProjectsView />` inside a `QueryClientProvider` with `next/navigation` mocked; the real button labels come from the components, so adjust a regexp if a label differs.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/projects/projects-access.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Project detail view**

In `project-detail-view.tsx`: add `import { Can } from '@/shared/components/common';` and `import { useCan } from '@/shared/lib/use-access';`. In `ProjectDetailView` add:

```tsx
  const canEdit = useCan('projects', 'write');
  const canDelete = useCan('projects', 'manage');
  const canViewKey = useCan('project_keys', 'read');
  const canRotateKey = useCan('project_keys', 'write');
  const canRevokeKey = useCan('project_keys', 'manage');
```

- The active switch group (the `<div className="flex items-center gap-2"> <Switch ... /> <span ...>Active/Deactivated</span> </div>`): render the switch only when `project.isActive ? canRevokeKey : canRotateKey`; always render the status text. Replace the `<Switch ... />` element with `{(project.isActive ? canRevokeKey : canRotateKey) ? (<Switch ... existing props ... />) : null}`.
- The Edit button: `<Can resource="projects" level="write">...</Can>`.
- The API key `<section aria-labelledby="api-key-heading" ...>`: render only `{canViewKey ? (<section ...>...</section>) : null}`, and pass the regenerate permission down: `<ApiKeyDisplay ... canRegenerate={canRotateKey} />`.
- The redirect section: pass `readOnly={!canEdit}` to `<RedirectUriManager ... />`.
- The Delete button's wrapper `<div className="flex justify-end border-t border-border pt-4"> ... </div>`: render only `{canDelete ? (...) : null}`.

In `ApiKeyDisplay.tsx`: add `canRegenerate?: boolean;` to `ApiKeyDisplayProps` (default `true`) and render the Regenerate `<Button>` only when it is true.

In `RedirectUriManager.tsx`: add `readOnly?: boolean;` to `RedirectUriManagerProps` (default `false`), and when true render the list of URIs without the add field and without the remove controls (return early with the same list markup and no inputs or buttons: keep the existing list rendering and guard the form and each remove button with `!readOnly`).

- [ ] **Step 4: Projects list, table and create**

In `projects-view.tsx`: add `import { useCan } from '@/shared/lib/use-access';` and `const canWrite = useCan('projects', 'write');`. Replace `<CreateProjectButton />` in the header with `{canWrite ? <CreateProjectButton /> : null}` and the empty state's `action={<CreateProjectButton />}` with `action={canWrite ? <CreateProjectButton /> : undefined}`.

In `ProjectTable.tsx`: add `import { useCan } from '@/shared/lib/use-access';`, change `buildDefaultColumns(onAction)` to take `access: { canDeactivate: boolean; canReactivate: boolean; canDelete: boolean }`, render the deactivate/reactivate switch or button only when `row.original.isActive ? access.canDeactivate : access.canReactivate`, the Delete button only when `access.canDelete`, and drop the actions column when none applies (same `.filter` pattern as `ServerTable`). In `ProjectTable` compute `canDeactivate = useCan('project_keys','manage')`, `canReactivate = useCan('project_keys','write')`, `canDelete = useCan('projects','manage')` and pass them.

In `ProjectForm.tsx`: add `const canServers = useCan('servers', 'read');` and render the server-selection field only when `canServers` (wrap the block that starts at the `{serversLoading ? (` branch and its label in `{canServers ? (...) : null}`).

- [ ] **Step 5: Server access**

In `ServerAccessMatrix.tsx`: add `import { useCan } from '@/shared/lib/use-access';`, compute `const canWrite = useCan('projects', 'write'); const canManage = useCan('projects', 'manage');`, and: disable the operation and scope controls when `!canWrite` (they already take `disabled={isMutating}`; make it `disabled={isMutating || !canWrite}`), and render the grant/revoke `Switch` only when the action it would take is allowed: `granted ? canManage : canWrite`.

- [ ] **Step 6: Outbound webhooks**

In `WebhookDetail.tsx`: wrap the Delete `<Button variant="danger" ...>` in `<Can resource="webhooks" level="manage">` (import `Can`).

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/projects tests/features/webhooks tests/app/dashboard`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/features/projects/projects-access.test.tsx
git add apps/web
git commit -m "feat(web): gate project, API key, server access and webhook actions by level"
```

---

### Task 6: Inbound webhooks

**Files:**
- Modify: `apps/web/src/app/dashboard/projects/[id]/inbound-webhooks/inbound-webhooks-view.tsx`, `apps/web/src/app/dashboard/projects/[id]/inbound-webhooks/[webhookId]/webhook-view.tsx`, `apps/web/src/features/inbound-webhooks/components/webhook-secret-section.tsx`, `webhook-delete-section.tsx`, `webhook-settings-form.tsx`, `webhook-schema-section.tsx`, `webhook-readers-section.tsx`, `default-readers-settings.tsx`
- Test: `apps/web/tests/app/dashboard/inbound-webhooks-access.test.tsx`

**Interfaces:**
- Consumes: `useCan`, `Can`.

The submissions tab is not gated (reader roles govern it). Levels: create, edit, set reader roles, rotate secret, save settings, toggle active: `inbound_webhooks:write`; delete: `inbound_webhooks:manage`. The default-readers editor also needs `servers:read` and `stats:read` for its role picker.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/app/dashboard/inbound-webhooks-access.test.tsx` rendering `WebhookView` (webhook endpoints mocked as in `tests/app/dashboard/inbound-webhook-manage.test.tsx`), `InboundWebhooksView`, and `DefaultReadersSettings`:

```tsx
describe('Inbound webhook access', () => {
  it('shows a read-only member no write or manage action on a webhook', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read' } });
    renderWebhook();
    await screen.findByRole('heading', { name: 'Contact form' });

    expect(screen.queryByRole('switch', { name: 'Active' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Schema' }));
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.queryByRole('button', { name: 'Rotate secret' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete webhook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it('keeps the Submissions tab for a read-only member', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read' } });
    renderWebhook();
    expect(await screen.findByRole('tab', { name: 'Submissions' })).toBeInTheDocument();
  });

  it('lets a writer rotate the secret but not delete', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write' } });
    renderWebhook();
    await screen.findByRole('heading', { name: 'Contact form' });
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete webhook' })).not.toBeInTheDocument();
  });

  it('lets a manager delete', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'manage' } });
    renderWebhook();
    await screen.findByRole('heading', { name: 'Contact form' });
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Delete webhook' })).toBeInTheDocument();
  });

  it('hides "New inbound webhook" without write', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read' } });
    renderList();
    await screen.findByRole('heading', { name: 'Inbound webhooks' });
    expect(screen.queryByRole('link', { name: /new inbound webhook/i })).not.toBeInTheDocument();
  });

  it('shows the default readers read-only without write or without the role picker data', async () => {
    signInAs({ permissions: { inbound_webhooks: 'write' } });
    renderDefaultReaders();
    await screen.findByText(/these come from the server configuration|default readers/i);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
```

(`renderWebhook`, `renderList`, `renderDefaultReaders` render the components inside a `QueryClientProvider`, with the endpoint mocks and the `next/navigation` mock taken from the two existing inbound tests.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/app/dashboard/inbound-webhooks-access.test.tsx`
Expected: FAIL.

- [ ] **Step 3: The list and the webhook view**

In `inbound-webhooks-view.tsx`: add `import { useCan } from '@/shared/lib/use-access';` and `const canCreate = useCan('inbound_webhooks', 'write');`. Make `newButton` conditional: `const newButton = canCreate ? (<Button asChild>...</Button>) : null;`, render `{newButton}` as before (it renders nothing when null), and change the empty state's `action={newButton}` to `action={newButton ?? undefined}`.

In `webhook-view.tsx`, in `ActiveSwitch`: add `const canWrite = useCan('inbound_webhooks', 'write');` and render the `<Switch .../>` only when `canWrite` (keep the Badge always). Import `useCan`.

- [ ] **Step 4: The settings tab sections**

- `webhook-secret-section.tsx`: at the top of the component add `const canRotate = useCan('inbound_webhooks', 'write');` and `if (!canRotate) return null;` after the hooks.
- `webhook-delete-section.tsx`: the same with `useCan('inbound_webhooks', 'manage')`.
- `webhook-settings-form.tsx`: add `const canWrite = useCan('inbound_webhooks', 'write');`, wrap the form's children in `<fieldset disabled={!canWrite} className="flex min-w-0 flex-col gap-5 border-0 p-0">`, and replace the Save `<Button type="submit" ...>` with `{canWrite ? (<Button ...existing...>) : (<Badge variant="secondary" className="self-end">Read only</Badge>)}` (import `Badge`).
- `webhook-schema-section.tsx`: add `const canWrite = useCan('inbound_webhooks', 'write');` and render the Edit `<Button type="button" variant="secondary" size="sm" onClick={() => setDraft(stored)}>Edit</Button>` only when `canWrite` (the not-editing branch of the ternary becomes `canWrite ? (<Button ...>Edit</Button>) : null`).
- `webhook-readers-section.tsx`: add `const canWrite = useCan('inbound_webhooks', 'write');`. Disable the picker and hide Save when read-only: pass `disabled={!canWrite}` to `<RolePicker ... />` if it supports it (see `role-picker.tsx`; if it has no `disabled` prop, add `disabled?: boolean` to it and apply it to its trigger and options), and render the Save button only when `canWrite`.

- [ ] **Step 5: The default readers settings**

In `default-readers-settings.tsx`: add `const canWrite = useCan('inbound_webhooks', 'write'); const canPick = useCan('servers', 'read') && useCan('stats', 'read');` (call both hooks unconditionally: `const canServers = useCan('servers', 'read'); const canStats = useCan('stats', 'read'); const canEdit = canWrite && canServers && canStats;`). When `!canEdit`, render the current default readers read-only instead of the picker and Save: replace the `<RolePicker ... />` and the Save `<Button>` with

```tsx
      {canEdit ? (
        <>
          <RolePicker
            options={roles.options}
            selected={selected}
            onChange={setPicked}
            isLoading={roles.isLoading}
          />
          <p className="text-body text-text-muted">
            An empty list is allowed: new webhooks then need their readers picked by hand.
          </p>
          <Button type="button" className="self-end" disabled={!changed || update.isPending} onClick={save}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="self-start">Read only</Badge>
          <ul className="flex flex-wrap gap-2">
            {settings.data.defaultReaderRoles.map((role) => (
              <li key={role.roleId}>
                <Badge variant="outline">{role.roleName}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
```

(import `Badge` and `useCan`; the exact field names of a default reader role are the ones of `settings.data.defaultReaderRoles` in the file's DTO: use `roleId` and `roleName` as the webhook readers section does.)

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/app/dashboard tests/features/inbound-webhooks tests/features/docs`
Expected: PASS. If a docs excerpt test fails for `webhook-schema-section.tsx` or `inbound-webhooks-view.tsx`, update that excerpt in `apps/web/src/content/docs/build/web-guide.mdx` to the new lines.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/app/dashboard/inbound-webhooks-access.test.tsx
git add apps/web
git commit -m "feat(web): gate inbound webhook actions by level"
```

---

### Task 7: The settings page, section by section

**Files:**
- Modify: `apps/web/src/app/dashboard/settings/page.tsx`, `apps/web/src/features/settings/components/CacheSettings.tsx`, `RateLimitSettings.tsx`, `PreferencesSettings.tsx`, `SettingsSection.tsx`
- Test: `apps/web/tests/features/settings/settings-access.test.tsx`

**Interfaces:**
- Consumes: `useCan`, `Can`.
- Produces: `CacheSettings`, `RateLimitSettings` and `PreferencesSettings` gain `readOnly?: boolean` (default `false`): the form is a disabled `<fieldset>`, the Save button is replaced by a "Read only" badge.

The page today loads the profile and the system settings together and shows one skeleton and one error for both. After this task each part has its own states, and a member without `settings:read` sees only the profile card.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/settings/settings-access.test.tsx` (reuse the MSW handlers of `settings-flow.test.tsx` for `/admin/settings` and `/admin/profile`, and its render helper):

```tsx
describe('Settings page access', () => {
  it('shows only the profile to a member with no settings access, and never asks for the settings', async () => {
    let settingsRequested = false;
    server.use(
      http.get(`${API}/admin/profile`, () => HttpResponse.json(profileDto)),
      http.get(`${API}/admin/settings`, () => {
        settingsRequested = true;
        return HttpResponse.json(settingsDto);
      })
    );
    signInAs({ permissions: {} });
    renderSettings();

    expect(await screen.findByText(/display name/i)).toBeInTheDocument();
    expect(screen.queryByText('Cache')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/last changed/i)).not.toBeInTheDocument();
    expect(screen.getByText('Manage your admin profile.')).toBeInTheDocument();
    expect(settingsRequested).toBe(false);
  });

  it('shows read-only forms to a reader, with no Save and no Reset', async () => {
    mockBoth();
    signInAs({ permissions: { settings: 'read' } });
    renderSettings();

    expect(await screen.findByText('Cache')).toBeInTheDocument();
    expect(screen.getAllByText('Read only').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument();
    expect(screen.getByText(/last changed/i)).toBeInTheDocument();
  });

  it('lets a writer save the forms but not reset', async () => {
    mockBoth();
    signInAs({ permissions: { settings: 'write' } });
    renderSettings();

    await screen.findByText('Cache');
    expect(screen.getAllByRole('button', { name: /save/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument();
  });

  it('lets a manager reset', async () => {
    mockBoth();
    signInAs({ permissions: { settings: 'manage' } });
    renderSettings();
    expect(await screen.findByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
  });

  it('keeps the settings visible when the profile fails to load, and the reverse', async () => {
    server.use(
      http.get(`${API}/admin/profile`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
      http.get(`${API}/admin/settings`, () => HttpResponse.json(settingsDto))
    );
    signInAs({ permissions: { settings: 'read' } });
    renderSettings();

    expect(await screen.findByText('Cache')).toBeInTheDocument();
    expect(await screen.findByText(/profile could not be loaded/i)).toBeInTheDocument();
  });
});
```

(`profileDto`, `settingsDto`, `mockBoth`, `renderSettings` and `API` come from the existing settings flow test; copy them.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/settings/settings-access.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Read-only forms**

For each of `CacheSettings.tsx`, `RateLimitSettings.tsx` and `PreferencesSettings.tsx`: add `readOnly?: boolean;` to the props interface (default `false`), wrap the `<form ...>` children in `<fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0"> ... </fieldset>`, and replace the submit `<Button type="submit" ...>` with `{readOnly ? <Badge variant="secondary" className="self-start">Read only</Badge> : (<Button ...existing...>)}` (import `Badge` from `@/shared/components/ui/badge`).

- [ ] **Step 4: Restructure the page**

In `apps/web/src/app/dashboard/settings/page.tsx`:

- add `import { Badge } from '@/shared/components/ui/badge';` is not needed here; add `import { useCan } from '@/shared/lib/use-access';`.
- in `SettingsPage` add:

```tsx
  const canRead = useCan('settings', 'read');
  const canWrite = useCan('settings', 'write');
  const canReset = useCan('settings', 'manage');
```

- the header: show the "Last changed" line only when `canRead && settings?.meta.updatedAt`; show the description as `canRead ? 'Configure MCDI behavior and manage your admin profile.' : 'Manage your admin profile.'`; show the "Reset to defaults" button only when `canReset`.
- replace the single `isError ? ... : settingsQuery.isPending || profileQuery.isPending || !settings ? ... : (...)` ternary with two independent parts inside the same `columns` layout wrapper:

```tsx
      <div className="columns-1 gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {profileQuery.isError ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-6 text-body text-error">
              <p>Your profile could not be loaded.</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => void profileQuery.refetch()}>
                <RefreshCw aria-hidden="true" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : profileQuery.data ? (
          <ProfileSettings
            profile={profileQuery.data}
            isSaving={updateProfileMutation.isPending}
            onSave={(payload) =>
              updateProfileMutation.mutate(payload, {
                onSuccess: () => showToast('Profile saved', 'success'),
                onError: (error) => showToast(error.message || 'Failed to save profile', 'error'),
              })
            }
          />
        ) : (
          <SkeletonCard showAvatar={false} lines={3} />
        )}

        {canRead ? (
          settingsQuery.isError ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-6 text-body text-error">
                <p>Settings could not be loaded.</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void settingsQuery.refetch()}>
                  <RefreshCw aria-hidden="true" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : settings ? (
            <>
              <DiscordConfigForm config={settings.discord} />
              <CacheSettings
                settings={settings.cache}
                isSaving={updateSettingsMutation.isPending}
                onSave={handleSaveSettings}
                readOnly={!canWrite}
              />
              <RateLimitSettings
                limits={settings.rateLimit}
                isSaving={updateSettingsMutation.isPending}
                onSave={handleSaveSettings}
                readOnly={!canWrite}
              />
              <PreferencesSettings
                preferences={settings.preferences}
                isSaving={updateSettingsMutation.isPending}
                onSave={handleSaveSettings}
                readOnly={!canWrite}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} showAvatar={false} lines={3} />
            ))
          )
        ) : null}
      </div>
```

- remove the now-unused combined `isError` constant. `const settings = settingsQuery.data;` stays. The reset `ConfirmDialog` stays at the bottom and is only reachable through the button, which is already gated.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/settings`
Expected: PASS, including the existing settings flow tests.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/features/settings/settings-access.test.tsx
git add apps/web
git commit -m "feat(web): follow the permission system section by section on the settings page"
```

---

### Task 8: The messages tab inside the channels page

**Files:**
- Modify: `apps/web/src/app/dashboard/servers/[id]/channels/channels-view.tsx`
- Test: `apps/web/tests/features/channels/channels-access.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/channels/channels-access.test.tsx` (channel and channel-list handlers as in the existing channels tests; render `<ChannelsView serverId="srv_1" />`):

```tsx
describe('Channels access', () => {
  it('shows the channel but not its message history without messages:read', async () => {
    mockChannels();
    signInAs({ permissions: { servers: 'read', channels: 'read' } });
    renderChannels();

    await userEvent.click(await screen.findByRole('button', { name: /general/i }));

    expect(await screen.findByText(/general/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load.*messages/i })).not.toBeInTheDocument();
  });

  it('offers the message history with messages:read', async () => {
    mockChannels();
    signInAs({ permissions: { servers: 'read', channels: 'read', messages: 'read' } });
    renderChannels();

    await userEvent.click(await screen.findByRole('button', { name: /general/i }));
    expect(await screen.findByRole('button', { name: /load.*messages/i })).toBeInTheDocument();
  });
});
```

(Use the label of the real "load" button in `MessageHistory`; read `features/channels/components/MessageHistory.tsx` to match it.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/channels/channels-access.test.tsx`
Expected: the first test FAILS.

- [ ] **Step 3: Gate the history**

In `channels-view.tsx`: add `import { useCan } from '@/shared/lib/use-access';`, add `const canReadMessages = useCan('messages', 'read');` in `ChannelsView`, and change the block

```tsx
              {activeChannelNode?.hasMessages ? (
                <MessageHistory ... />
              ) : (
                <p ...>This channel type has no readable message history.</p>
              )}
```

to

```tsx
              {!canReadMessages ? null : activeChannelNode?.hasMessages ? (
                <MessageHistory ... />
              ) : (
                <p ...>This channel type has no readable message history.</p>
              )}
```

(keeping the existing `MessageHistory` props and the paragraph unchanged).

- [ ] **Step 4: Run the tests and commit**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/channels`
Expected: PASS.

```bash
pnpm exec prettier --write apps/web/src/app/dashboard/servers apps/web/tests/features/channels/channels-access.test.tsx
git add apps/web
git commit -m "feat(web): show message history only with messages:read"
```

---

### Task 9: Docs, final verification and the pull request

**Files:**
- Modify: `apps/web/src/content/docs/build/web-guide.mdx`, `apps/web/CLAUDE.md`, `apps/web/AGENTS.md`

- [ ] **Step 1: Document the rules**

In `apps/web/src/content/docs/build/web-guide.mdx`, in the section that describes the sidebar and who gets in (search for the heading `who-gets-in` or the paragraph that starts "1. **`proxy.ts`**"), add a numbered point after the proxy and the client guard:

```
3. **The access rules** decide what a signed-in admin sees. `GET /api/auth/admin/me` returns the member's effective level per resource, and the panel keeps it in the auth store. `src/shared/lib/route-access.ts` lists who may open each dashboard page, and the page guard refuses a page that is not listed. `useCan(resource, level)` and `<Can>` hide the actions a member's level does not reach, and every query hook is disabled when the member cannot read its resource. The panel only adapts to these rules: the API refuses what a member may not do, and a refused call refreshes the member's access.
```

Add `` `apps/web/src/shared/lib/access.ts` ``, `` `apps/web/src/shared/lib/route-access.ts` `` and `` `apps/web/src/shared/lib/use-access.ts` `` to that page's final `Source:` line.

In `apps/web/CLAUDE.md` (and the same short block in `apps/web/AGENTS.md`), add under "Gotchas":

```
7. **Access levels**: every page under `app/dashboard` needs an entry in `src/shared/lib/route-access.ts` (a test fails without it, and an unlisted route is denied). A write or manage action is wrapped in `<Can resource level>` or checked with `useCan`, and a new query hook calls `useCan(resource, 'read')` into its `enabled`. The panel adapts to the member's levels; the API enforces them.
```

- [ ] **Step 2: Run the docs tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/docs`
Expected: PASS.

- [ ] **Step 3: Full verification**

```bash
pnpm typecheck
pnpm --filter @mcdi/web exec vitest run
pnpm --filter @mcdi/web run lint
pnpm --filter @mcdi/web run format:check
pnpm --filter @mcdi/api exec jest --config jest.config.cjs
pnpm build
```

Expected: everything passes. Run `pnpm build` in a clean shell. If `format:check` or lint reports a file you did not change, leave it.

- [ ] **Step 4: Push and open the pull request to `dev`**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin benabdou/admin-panel-gating
gh pr create --base dev --head benabdou/admin-panel-gating \
  --title "feat(web): gate every query, section and action by the member's access level" \
  --body "## Summary
Second of three PRs for the panel. Design: \`docs/superpowers/specs/2026-10-07-admin-panel-access-design.md\`. Builds on the foundations PR (rules, route table, guard, sidebar).

The panel now follows the member's access levels everywhere, not just at the door:
- Every query hook is disabled when the member cannot read its resource, so no request is sent for data they may not see.
- Sections of mixed pages and secondary data (filters, pickers, cards, actor names) degrade silently.
- Every write and manage action is shown only at the member's level (hidden, not disabled); forms the member can read but not change show a 'Read only' badge.
- The settings page is restructured so the profile, the system settings, saving and resetting each follow their own level.
- Inbound webhook submissions stay governed by reader roles, as before.

## Test plan
- [x] Unit and component tests for the rules, hooks, route table (incl. the filesystem coverage test), page guard, sidebar, 403 refresh, query gating and each gated area
- [x] Full web suite passes; the default test user is root, limited and anonymous users are set explicitly
- [x] \`pnpm typecheck\`, \`pnpm build\`, lint on the changed files, API unit tests"
```

Expected: the PR URL is printed. The commits and the PR body carry no Claude signature.
