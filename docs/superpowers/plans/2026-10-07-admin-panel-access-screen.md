# Admin Panel Access Screen Implementation Plan (PR 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a root admin manage role grants and per-person overrides from the panel: a root-only Access screen with a role editor and a list of members with overrides, and a root-only Access page for one member.

**Architecture:** Two small API additions (a list of members with overrides, and profile fields on the member `effective` response) back a new `features/access` module in the web app: query and mutation hooks for the existing `/admin/access` API, pure helpers for drafts, lowering detection and "unreachable in the panel" hints, a radio-group level control, a role editor, a member editor and an overview list. Everything is root only, through the route table from PR 1.

**Tech Stack:** NestJS 11 + Drizzle (API); Next.js 16, React 19, TanStack Query v5, Tailwind v4, Vitest + RTL + MSW (web).

**Spec:** `docs/superpowers/specs/2026-10-07-admin-panel-access-design.md` (Part 2). It depends on PR 1 (`docs/superpowers/plans/2026-10-07-admin-panel-foundations.md`) being merged; it does not need the gating PR. It uses `useCanAccess`, `ROOT_ONLY`, `ROUTE_RULES`, `RESOURCE_TITLES`, `Requirement` helpers and the test helpers in `tests/helpers/auth.ts`.

## Global Constraints

- Everything on the Access screen and the member Access page is root only. The route table entries are `ROOT_ONLY`, and every hook of the `access` feature is enabled only for root. The API (`@RootOnly()`) is the real enforcement.
- A role grant is never `none`: a resource set to none is left out of the `PUT`. A member override may be `none` (a deny), and "Inherit" leaves a resource out of the override `PUT`, because the API replaces the whole set.
- Root roles and root members are shown locked, with no controls. The API refuses to edit them.
- A save that lowers a role grant asks first. A save that sets a member override below the member's current effective level asks first. Raising or inheriting asks nothing. (Removing an override is not confirmed, because the API does not say what the roles would grant.)
- A grant that cannot be reached in the panel for lack of a prerequisite shows a hint. The hints come from the route table, plus three explicit entries for `messages`, `project_keys` and `settings`.
- The API's 400 and 404 messages show as toasts, and the editor keeps the unsaved form.
- The new API endpoint has no pagination (bounded by the club's size); say so in its Swagger text.
- The member detail page (`/dashboard/members/[discordId]`) cannot load today because the API has no `GET /admin/members/:discordId`. The Access page must not depend on it.
- API conventions: unit specs next to source, e2e in `apps/api/test`, `pnpm exec eslint --fix` only on changed files, migrations idempotent (no migration is needed here). Web conventions as in PR 1: named exports, `import type`, no `any`, design tokens, `cn()`, `lucide-react`, tests only under `apps/web/tests`.
- Commits and the PR carry no `Co-Authored-By` trailer and no Claude signature. Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`. The PR targets `dev`.
- Branch: `benabdou/admin-panel-access`, created from the latest `origin/dev` after the foundations PR has merged.
- All commands run from the repository root `/Users/destockphonedz/Documents/MCDI/MCDI` unless a step says otherwise. For API e2e use a throwaway database and blank Discord tokens (see "Running the e2e suite locally" in `docs/superpowers/plans/2026-10-07-admin-permissions.md`, Task 15). Do not run `pnpm build` in a shell where `apps/api/.env` was sourced.

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/modules/admin-access/admin-access.repository.ts` (modify) | `findMemberProfile`, `listOverrideRows` |
| `apps/api/src/modules/admin-access/admin-access-grants.service.ts` (modify) | `listMemberOverrides`, profile on `getMemberEffective` |
| `apps/api/src/modules/admin-access/admin-access.controller.ts` (modify) | `GET /admin/access/overrides` |
| `apps/api/src/common/guards/admin-access-coverage.spec.ts` (modify) | Pins the new route |
| `apps/web/src/features/access/types/index.ts` (create) | DTO types |
| `apps/web/src/features/access/api/{keys,service,queries,mutations}.ts` (create) | Data access, root only |
| `apps/web/src/features/access/lib/grants.ts` (create) | Drafts, payloads, lowering detection |
| `apps/web/src/shared/lib/reachability.ts` (create) | "Unreachable in the panel" hints |
| `apps/web/src/features/access/components/*` (create) | `LevelControl`, `RoleList`, `RoleEditor`, `MemberAccessEditor`, `OverridesList`, `MemberChip` |
| `apps/web/src/app/dashboard/access/{page,access-view}.tsx` (create) | The Access screen |
| `apps/web/src/app/dashboard/members/[discordId]/access/{page,member-access-view}.tsx` (create) | The member Access page |
| `apps/web/src/shared/lib/route-access.ts`, `nav-items.ts`, member page, audit filter (modify) | Wiring |

---

### Task 1: API: the overrides list and profile on `effective`

**Files:**
- Modify: `apps/api/src/modules/admin-access/admin-access.repository.ts`, `admin-access-grants.service.ts`, `admin-access.controller.ts`
- Modify: `apps/api/src/common/guards/admin-access-coverage.spec.ts`
- Test: `apps/api/src/modules/admin-access/admin-access-grants.service.spec.ts`, `admin-access.controller.spec.ts`

**Interfaces:**
- Produces: `AdminAccessRepository.findMemberProfile(memberId): Promise<{ id; username; globalName; displayName; avatar } | null>`; `AdminAccessRepository.listOverrideRows(): Promise<Array<{ memberId; resource; level; username; globalName; displayName; avatar }>>`; `AdminAccessGrantsService.listMemberOverrides(): Promise<{ members: Array<{ memberId; username; displayName; avatar; root; overrides }> }>`; `getMemberEffective` now returns `{ memberId, username, displayName, avatar, root, access }`; `GET /api/admin/access/overrides` (root only).

- [ ] **Step 1: Update the grants service spec (failing)**

In `apps/api/src/modules/admin-access/admin-access-grants.service.spec.ts`:

1. Add `findMemberProfile: jest.fn(), listOverrideRows: jest.fn(),` to the `repo` mock object.
2. In `beforeEach`, after `repo.memberExists.mockResolvedValue(true);` add:

```ts
    repo.findMemberProfile.mockResolvedValue({
      id: 'member-9',
      username: 'ada',
      globalName: 'Ada G',
      displayName: null,
      avatar: 'https://cdn.example/ada.png',
    });
    repo.listOverrideRows.mockResolvedValue([]);
```

3. Replace the whole `describe('getMemberEffective', ...)` block with:

```ts
  describe('getMemberEffective', () => {
    it('returns the member profile and the resolved level with its source per resource', async () => {
      const resolved = {
        root: false,
        access: {
          members: { level: 'read', source: { type: 'role', roleId: 'role-hr' } },
        },
      };
      access.getEffectiveAccess.mockResolvedValue(resolved);

      await expect(service.getMemberEffective('member-9')).resolves.toEqual({
        memberId: 'member-9',
        username: 'ada',
        displayName: 'Ada G',
        avatar: 'https://cdn.example/ada.png',
        ...resolved,
      });
    });

    it('returns 404 for an unknown member', async () => {
      repo.findMemberProfile.mockResolvedValue(null);
      await expect(service.getMemberEffective('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMemberOverrides', () => {
    const row = (memberId: string, resource: string, level: string, name: string) => ({
      memberId,
      resource,
      level,
      username: name.toLowerCase(),
      globalName: null,
      displayName: name,
      avatar: null,
    });

    it('groups the rows by member, sorts by name and flags members who are root now', async () => {
      repo.listOverrideRows.mockResolvedValue([
        row('m2', 'messages', 'none', 'Zed'),
        row('m1', 'projects', 'manage', 'Ada'),
        row('m1', 'stats', 'read', 'Ada'),
      ]);
      access.getEffectiveAccess.mockImplementation(async (id: string) => ({
        root: id === 'm2',
        access: {},
      }));

      const result = await service.listMemberOverrides();

      expect(result).toEqual({
        members: [
          {
            memberId: 'm1',
            username: 'ada',
            displayName: 'Ada',
            avatar: null,
            root: false,
            overrides: { projects: 'manage', stats: 'read' },
          },
          {
            memberId: 'm2',
            username: 'zed',
            displayName: 'Zed',
            avatar: null,
            root: true,
            overrides: { messages: 'none' },
          },
        ],
      });
    });

    it('is empty when nobody has an override', async () => {
      await expect(service.listMemberOverrides()).resolves.toEqual({ members: [] });
    });
  });
```

In `apps/api/src/modules/admin-access/admin-access.controller.spec.ts`: add `listMemberOverrides: jest.fn(),` to the `grants` mock and add the test

```ts
  it('lists the members that have overrides', async () => {
    grants.listMemberOverrides.mockResolvedValue({ members: [] });
    await expect(controller.listMemberOverrides()).resolves.toEqual({ members: [] });
  });
```

In `apps/api/src/common/guards/admin-access-coverage.spec.ts`, add to `EXPECTED` after the `PUT /admin/access/roles/:roleId` entry:

```ts
  'GET /admin/access/overrides': 'root',
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/api exec jest src/modules/admin-access src/common/guards/admin-access-coverage.spec.ts`
Expected: FAIL (`listMemberOverrides` does not exist, `getMemberEffective` lacks the profile).

- [ ] **Step 3: Repository**

Add to `AdminAccessRepository` in `admin-access.repository.ts`:

```ts
  async findMemberProfile(memberId: string): Promise<{
    id: string;
    username: string;
    globalName: string | null;
    displayName: string | null;
    avatar: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        id: schema.members.id,
        username: schema.members.username,
        globalName: schema.members.globalName,
        displayName: schema.members.displayName,
        avatar: schema.members.avatar,
      })
      .from(schema.members)
      .where(eq(schema.members.id, memberId))
      .limit(1);
    return row ?? null;
  }

  /** Every override row with the member it belongs to. */
  async listOverrideRows(): Promise<
    Array<{
      memberId: string;
      resource: string;
      level: AccessLevel;
      username: string;
      globalName: string | null;
      displayName: string | null;
      avatar: string | null;
    }>
  > {
    return this.db
      .select({
        memberId: schema.adminMemberAccess.memberId,
        resource: schema.adminMemberAccess.resource,
        level: schema.adminMemberAccess.level,
        username: schema.members.username,
        globalName: schema.members.globalName,
        displayName: schema.members.displayName,
        avatar: schema.members.avatar,
      })
      .from(schema.adminMemberAccess)
      .innerJoin(
        schema.members,
        eq(schema.adminMemberAccess.memberId, schema.members.id),
      );
  }
```

- [ ] **Step 4: Service**

In `admin-access-grants.service.ts`, replace `getMemberEffective` with:

```ts
  async getMemberEffective(memberId: string) {
    const profile = await this.repository.findMemberProfile(memberId);
    if (!profile) throw new NotFoundException('Member not found');

    const { root, access } = await this.access.getEffectiveAccess(memberId);
    return {
      memberId,
      username: profile.username,
      displayName: profile.displayName ?? profile.globalName ?? profile.username,
      avatar: profile.avatar,
      root,
      access,
    };
  }

  /**
   * Every member who has an override, for the Access screen's overview. Not paginated: the list is
   * bounded by the size of the club. `root` marks a member whose overrides are inactive because
   * they currently hold a root role.
   */
  async listMemberOverrides() {
    const rows = await this.repository.listOverrideRows();

    const byMember = new Map<
      string,
      {
        memberId: string;
        username: string;
        displayName: string;
        avatar: string | null;
        overrides: Record<string, AccessLevel>;
      }
    >();
    for (const row of rows) {
      const entry = byMember.get(row.memberId) ?? {
        memberId: row.memberId,
        username: row.username,
        displayName: row.displayName ?? row.globalName ?? row.username,
        avatar: row.avatar,
        overrides: {},
      };
      entry.overrides[row.resource] = row.level;
      byMember.set(row.memberId, entry);
    }

    const members = [...byMember.values()].sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }) ||
        a.memberId.localeCompare(b.memberId),
    );
    const roots = await Promise.all(
      members.map(
        async (member) => (await this.access.getEffectiveAccess(member.memberId)).root,
      ),
    );

    return { members: members.map((member, index) => ({ ...member, root: roots[index] })) };
  }
```

- [ ] **Step 5: Controller**

In `admin-access.controller.ts`, add after `listRoles()` (before `setRoleGrants`):

```ts
  @Get('overrides')
  @ApiOperation({
    summary: 'List the members that have overrides',
    description:
      'Every member with at least one override and their overrides, ordered by name. Not paginated: ' +
      "the list is bounded by the club's size. `root` marks a member whose overrides are inactive " +
      'because they currently hold a root role.',
  })
  @ApiOkResponse({ description: 'Members with their overrides.' })
  listMemberOverrides() {
    return this.grants.listMemberOverrides();
  }
```

and update the `getMemberEffective` Swagger text: description `'The member's name, the resolved level per resource and where it comes from: root, an override, or the role that supplied it.'`.

- [ ] **Step 6: Run the tests and typecheck**

```bash
pnpm --filter @mcdi/api exec eslint --fix src/modules/admin-access src/common/guards/admin-access-coverage.spec.ts
pnpm --filter @mcdi/api exec jest src/modules/admin-access src/common/guards
pnpm --filter @mcdi/api run typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): list members with overrides and return the profile on effective access"
```

---

### Task 2: API: end-to-end tests and the API reference

**Files:**
- Modify: `apps/api/test/admin-access.e2e-spec.ts`
- Regenerate: `apps/api/openapi.json` and `apps/web/src/content/docs/api-reference/**`

- [ ] **Step 1: Add the e2e tests**

In `apps/api/test/admin-access.e2e-spec.ts`, add `adminMemberAccess` to the import from `'../src/database/entities'` (`import { adminMemberAccess, auditLogs } from '../src/database/entities';`) and append inside the top-level `describe`:

```ts
  it('lists the members that have overrides, root only', async () => {
    await http()
      .put(`/api/admin/access/members/${dev.memberId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { messages: 'none', projects: 'manage' } })
      .expect(200);

    const res = await http()
      .get('/api/admin/access/overrides')
      .set('Authorization', as(root.bearerToken))
      .expect(200);

    expect(res.body.members).toEqual([
      {
        memberId: dev.memberId,
        username: 'member2',
        displayName: 'Member 2',
        avatar: null,
        root: false,
        overrides: { messages: 'none', projects: 'manage' },
      },
    ]);

    await http()
      .get('/api/admin/access/overrides')
      .set('Authorization', as(dev.bearerToken))
      .expect(403);
  });

  it('flags a member whose overrides are inactive because they are root now', async () => {
    // A row left over from before the member became root: the API would refuse to write it today.
    await db.insert(adminMemberAccess).values({
      memberId: root.memberId,
      resource: 'messages',
      level: 'none',
    });

    const res = await http()
      .get('/api/admin/access/overrides')
      .set('Authorization', as(root.bearerToken))
      .expect(200);

    expect(res.body.members).toEqual([
      expect.objectContaining({
        memberId: root.memberId,
        root: true,
        overrides: { messages: 'none' },
      }),
    ]);
  });

  it('returns the member profile with the effective access, and 404 for an unknown member', async () => {
    const res = await http()
      .get(`/api/admin/access/members/${dev.memberId}/effective`)
      .set('Authorization', as(root.bearerToken))
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        memberId: dev.memberId,
        username: 'member2',
        displayName: 'Member 2',
        root: false,
      }),
    );

    await http()
      .get('/api/admin/access/members/999999999999999999/effective')
      .set('Authorization', as(root.bearerToken))
      .expect(404);
  });
```

- [ ] **Step 2: Run the e2e suite for access**

```bash
psql postgresql://myuser:mypassword@localhost:5432/mcdi -tc "select 1 from pg_database where datname='mcdi_test'" | grep -q 1 || psql postgresql://myuser:mypassword@localhost:5432/mcdi -c "create database mcdi_test"
cd apps/api && set -a && . ./.env && set +a
export DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mcdi_test REDIS_HOST=localhost REDIS_KEY_PREFIX=mcdi_test DISCORD_TOKEN= DISCORD_BOT_TOKEN=
pnpm run db:migrate && pnpm run test:e2e -- admin-access
```

Expected: PASS (both `admin-access` suites). Run the e2e in a subshell or a new shell afterwards so the exported `.env` does not leak into the build.

- [ ] **Step 3: Regenerate the API reference and run the docs tests**

```bash
pnpm docs:api
pnpm --filter @mcdi/web exec vitest run tests/features/docs
```

Expected: `apps/api/openapi.json` and `api-reference/admin/admin-access.mdx` and `overview.mdx` change (a new `GET /api/admin/access/overrides` and the extended `effective` text); docs tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test apps/api/openapi.json apps/web/src/content/docs
git commit -m "test(api): cover the overrides list and member profile; regenerate the API reference"
```

---

### Task 3: The `access` feature's data layer

**Files:**
- Create: `apps/web/src/features/access/types/index.ts`, `api/keys.ts`, `api/service.ts`, `api/queries.ts`, `api/mutations.ts`, `index.ts`
- Test: `apps/web/tests/features/access/api/access-api.test.tsx`

**Interfaces:**
- Consumes: `apiClient`, `useCanAccess`, `ROOT_ONLY`.
- Produces: types `AccessCatalogDto`, `AccessRoleDto`, `RoleGrantsDto`, `MemberOverridesMap`, `MemberOverridesDto`, `MemberEffectiveDto`, `EffectiveSourceDto`, `OverrideMemberDto`, `OverridesListDto`; `accessKeys`; service functions `fetchAccessCatalog`, `fetchAccessRoles`, `setRoleGrants`, `fetchMemberOverrides`, `setMemberOverrides`, `fetchMemberEffective`, `fetchOverridesList`; hooks `useAccessCatalogQuery`, `useAccessRolesQuery`, `useMemberOverridesQuery(memberId)`, `useMemberEffectiveQuery(memberId)`, `useOverridesListQuery`, `useSetRoleGrantsMutation`, `useSetMemberOverridesMutation(memberId)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/access/api/access-api.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { signInAs } from '../../../helpers/auth';
import {
  useAccessRolesQuery,
  useMemberEffectiveQuery,
  useOverridesListQuery,
  useSetMemberOverridesMutation,
  useSetRoleGrantsMutation,
} from '@/features/access';

const API = 'http://localhost:3000/api';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('access queries', () => {
  it('fetches the roles for root', async () => {
    server.use(
      http.get(`${API}/admin/access/roles`, () =>
        HttpResponse.json([{ id: 'r1', name: 'HR', position: 3, root: false, grants: { members: 'read' } }])
      )
    );
    signInAs({ root: true });

    const { result } = renderHook(() => useAccessRolesQuery(), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('HR'));
  });

  it('sends nothing for a member who is not root', async () => {
    let requested = false;
    server.use(
      http.get(`${API}/admin/access/overrides`, () => {
        requested = true;
        return HttpResponse.json({ members: [] });
      })
    );
    signInAs({ permissions: { members: 'manage' } });

    const { result } = renderHook(() => useOverridesListQuery(), { wrapper: setup().wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).toBe(false);
  });

  it('reads one member with the profile and the sources', async () => {
    server.use(
      http.get(`${API}/admin/access/members/m1/effective`, () =>
        HttpResponse.json({
          memberId: 'm1',
          username: 'ada',
          displayName: 'Ada',
          avatar: null,
          root: false,
          access: { members: { level: 'read', source: { type: 'role', roleId: 'r1' } } },
        })
      )
    );
    signInAs({ root: true });

    const { result } = renderHook(() => useMemberEffectiveQuery('m1'), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.data?.displayName).toBe('Ada'));
  });
});

describe('access mutations', () => {
  it('replaces a role grants with a PUT and refreshes the roles', async () => {
    let body: unknown;
    let rolesFetches = 0;
    server.use(
      http.put(`${API}/admin/access/roles/r1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ roleId: 'r1', grants: { members: 'read' } });
      }),
      http.get(`${API}/admin/access/roles`, () => {
        rolesFetches += 1;
        return HttpResponse.json([]);
      })
    );
    signInAs({ root: true });
    const { wrapper } = setup();

    const roles = renderHook(() => useAccessRolesQuery(), { wrapper });
    const mutation = renderHook(() => useSetRoleGrantsMutation(), { wrapper });
    await waitFor(() => expect(rolesFetches).toBe(1));

    await act(() => mutation.result.current.mutateAsync({ roleId: 'r1', grants: { members: 'read' } }));

    expect(body).toEqual({ grants: { members: 'read' } });
    await waitFor(() => expect(rolesFetches).toBe(2));
    expect(roles.result.current.isError).toBe(false);
  });

  it('replaces a member overrides with a PUT', async () => {
    let body: unknown;
    server.use(
      http.put(`${API}/admin/access/members/m1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ memberId: 'm1', overrides: { messages: 'none' } });
      })
    );
    signInAs({ root: true });

    const { result } = renderHook(() => useSetMemberOverridesMutation('m1'), { wrapper: setup().wrapper });
    await act(() => result.current.mutateAsync({ messages: 'none' }));

    expect(body).toEqual({ grants: { messages: 'none' } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/api/access-api.test.tsx`
Expected: FAIL, `@/features/access` not found.

- [ ] **Step 3: Types, keys and service**

Create `apps/web/src/features/access/types/index.ts`:

```ts
import type { AccessLevel, AccessResource, GrantLevel } from '@mcdi/contracts';

export interface CatalogEntryDto<K extends string> {
  key: K;
  description: string;
}

export interface AccessCatalogDto {
  resources: CatalogEntryDto<AccessResource>[];
  levels: CatalogEntryDto<AccessLevel>[];
}

/** A resource missing from the map has no grant. */
export type RoleGrantsDto = Partial<Record<AccessResource, GrantLevel>>;

export interface AccessRoleDto {
  id: string;
  name: string;
  position: number | null;
  /** A root role holds full access and cannot be edited. */
  root: boolean;
  grants: RoleGrantsDto;
}

/** A resource missing from the map is inherited from the member's roles. */
export type MemberOverridesMap = Partial<Record<AccessResource, AccessLevel>>;

export interface MemberOverridesDto {
  memberId: string;
  overrides: MemberOverridesMap;
}

export type EffectiveSourceDto =
  | { type: 'root' }
  | { type: 'override' }
  | { type: 'role'; roleId: string }
  | { type: 'none' };

export interface MemberEffectiveDto {
  memberId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  root: boolean;
  access: Record<AccessResource, { level: AccessLevel; source: EffectiveSourceDto }>;
}

export interface OverrideMemberDto {
  memberId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  /** True when the member holds a root role now, so the overrides are inactive. */
  root: boolean;
  overrides: MemberOverridesMap;
}

export interface OverridesListDto {
  members: OverrideMemberDto[];
}
```

Create `apps/web/src/features/access/api/keys.ts`:

```ts
export const accessKeys = {
  all: ['access'] as const,
  catalog: () => [...accessKeys.all, 'catalog'] as const,
  roles: () => [...accessKeys.all, 'roles'] as const,
  overridesList: () => [...accessKeys.all, 'overrides'] as const,
  memberOverrides: (memberId: string) => [...accessKeys.all, 'member', memberId, 'overrides'] as const,
  memberEffective: (memberId: string) => [...accessKeys.all, 'member', memberId, 'effective'] as const,
};
```

Create `apps/web/src/features/access/api/service.ts`:

```ts
import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  AccessCatalogDto,
  AccessRoleDto,
  MemberEffectiveDto,
  MemberOverridesDto,
  MemberOverridesMap,
  OverridesListDto,
  RoleGrantsDto,
} from '@/features/access/types';

const BASE = '/admin/access';

export function fetchAccessCatalog(): Promise<ApiResponse<AccessCatalogDto>> {
  return apiClient.get<AccessCatalogDto>(`${BASE}/catalog`);
}

export function fetchAccessRoles(): Promise<ApiResponse<AccessRoleDto[]>> {
  return apiClient.get<AccessRoleDto[]>(`${BASE}/roles`);
}

/** Replaces every grant of the role. A resource left out has no grant. */
export function setRoleGrants(
  roleId: string,
  grants: RoleGrantsDto
): Promise<ApiResponse<{ roleId: string; grants: RoleGrantsDto }>> {
  return apiClient.put(`${BASE}/roles/${encodeURIComponent(roleId)}`, { grants });
}

export function fetchMemberOverrides(memberId: string): Promise<ApiResponse<MemberOverridesDto>> {
  return apiClient.get<MemberOverridesDto>(`${BASE}/members/${encodeURIComponent(memberId)}`);
}

/** Replaces every override of the member. A resource left out is inherited from their roles. */
export function setMemberOverrides(
  memberId: string,
  overrides: MemberOverridesMap
): Promise<ApiResponse<MemberOverridesDto>> {
  return apiClient.put(`${BASE}/members/${encodeURIComponent(memberId)}`, { grants: overrides });
}

export function fetchMemberEffective(memberId: string): Promise<ApiResponse<MemberEffectiveDto>> {
  return apiClient.get<MemberEffectiveDto>(
    `${BASE}/members/${encodeURIComponent(memberId)}/effective`
  );
}

export function fetchOverridesList(): Promise<ApiResponse<OverridesListDto>> {
  return apiClient.get<OverridesListDto>(`${BASE}/overrides`);
}
```

- [ ] **Step 4: Queries, mutations and the barrel**

Create `apps/web/src/features/access/api/queries.ts`:

```ts
'use client';

import { useQuery } from '@tanstack/react-query';

import { accessKeys } from '@/features/access/api/keys';
import {
  fetchAccessCatalog,
  fetchAccessRoles,
  fetchMemberEffective,
  fetchMemberOverrides,
  fetchOverridesList,
} from '@/features/access/api/service';
import { ROOT_ONLY } from '@/shared/lib/access';
import { useCanAccess } from '@/shared/lib/use-access';

/** Every hook here is enabled only for root: the API refuses everyone else. */
export function useAccessCatalogQuery() {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.catalog(),
    queryFn: async () => (await fetchAccessCatalog()).data,
    enabled: isRoot,
    staleTime: Infinity,
  });
}

export function useAccessRolesQuery() {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.roles(),
    queryFn: async () => (await fetchAccessRoles()).data,
    enabled: isRoot,
  });
}

export function useMemberOverridesQuery(memberId: string) {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.memberOverrides(memberId),
    queryFn: async () => (await fetchMemberOverrides(memberId)).data,
    enabled: isRoot && memberId.length > 0,
    retry: false,
  });
}

export function useMemberEffectiveQuery(memberId: string) {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.memberEffective(memberId),
    queryFn: async () => (await fetchMemberEffective(memberId)).data,
    enabled: isRoot && memberId.length > 0,
    retry: false,
  });
}

export function useOverridesListQuery() {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.overridesList(),
    queryFn: async () => (await fetchOverridesList()).data,
    enabled: isRoot,
  });
}
```

Create `apps/web/src/features/access/api/mutations.ts`:

```ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accessKeys } from '@/features/access/api/keys';
import { setMemberOverrides, setRoleGrants } from '@/features/access/api/service';
import type { MemberOverridesMap, RoleGrantsDto } from '@/features/access/types';
import type { ApiError } from '@/shared/types';

export function useSetRoleGrantsMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { roleId: string; grants: RoleGrantsDto }>({
    mutationFn: ({ roleId, grants }) => setRoleGrants(roleId, grants),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accessKeys.roles() }),
  });
}

export function useSetMemberOverridesMutation(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, MemberOverridesMap>({
    mutationFn: (overrides) => setMemberOverrides(memberId, overrides),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accessKeys.memberOverrides(memberId) }),
        queryClient.invalidateQueries({ queryKey: accessKeys.memberEffective(memberId) }),
        queryClient.invalidateQueries({ queryKey: accessKeys.overridesList() }),
      ]);
    },
  });
}
```

Create `apps/web/src/features/access/index.ts`:

```ts
export { accessKeys } from './api/keys';
export {
  useAccessCatalogQuery,
  useAccessRolesQuery,
  useMemberEffectiveQuery,
  useMemberOverridesQuery,
  useOverridesListQuery,
} from './api/queries';
export { useSetMemberOverridesMutation, useSetRoleGrantsMutation } from './api/mutations';
export type * from './types';
```

- [ ] **Step 5: Run the test and commit**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/api`
Expected: PASS.

```bash
pnpm exec prettier --write apps/web/src/features/access apps/web/tests/features/access
git add apps/web
git commit -m "feat(web): add the data layer for the Access screen"
```

---

### Task 4: Drafts, lowering detection and reachability hints

**Files:**
- Create: `apps/web/src/features/access/lib/grants.ts`
- Create: `apps/web/src/shared/lib/reachability.ts`
- Test: `apps/web/tests/features/access/lib/grants.test.ts`, `apps/web/tests/shared/lib/reachability.test.ts`

**Interfaces:**
- Produces from `grants.ts`: `Draft` (`Record<AccessResource, AccessLevel>`), `draftFromGrants(grants)`, `grantsPayload(draft)`, `isDirty(a, b)`, `loweredResources(before, after)`, `OverrideDraft` (`Partial<Record<AccessResource, AccessLevel>>`), `overridesPayload(draft)`, `loweredOverrides(effective, draft)`. From `reachability.ts`: `UnreachableGrant`, `unreachableGrants(levels: Permissions): UnreachableGrant[]`, `describeUnreachable(grant): string`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/features/access/lib/grants.test.ts`:

```ts
import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import {
  draftFromGrants,
  grantsPayload,
  isDirty,
  loweredOverrides,
  loweredResources,
  overridesPayload,
} from '@/features/access/lib/grants';

describe('role drafts', () => {
  it('starts from the grants with every other resource none', () => {
    const draft = draftFromGrants({ members: 'read', projects: 'manage' });

    expect(Object.keys(draft)).toEqual([...ACCESS_RESOURCES]);
    expect(draft.members).toBe('read');
    expect(draft.projects).toBe('manage');
    expect(draft.messages).toBe('none');
  });

  it('leaves none out of the payload', () => {
    const draft = { ...draftFromGrants({}), members: 'read', audit: 'none' } as ReturnType<typeof draftFromGrants>;
    expect(grantsPayload(draft)).toEqual({ members: 'read' });
  });

  it('detects a change', () => {
    const saved = draftFromGrants({ members: 'read' });
    expect(isDirty(saved, draftFromGrants({ members: 'read' }))).toBe(false);
    expect(isDirty(saved, draftFromGrants({ members: 'write' }))).toBe(true);
  });

  it('lists the resources whose level goes down, and not the ones that go up or stay', () => {
    const before = draftFromGrants({ members: 'manage', audit: 'read', stats: 'read' });
    const after = draftFromGrants({ members: 'read', audit: 'none', stats: 'write', sync: 'read' });

    expect(loweredResources(before, after)).toEqual(['members', 'audit']);
  });
});

describe('member overrides', () => {
  it('sends only the resources that are overridden, none included', () => {
    expect(overridesPayload({ messages: 'none', projects: 'manage' })).toEqual({
      messages: 'none',
      projects: 'manage',
    });
    expect(overridesPayload({})).toEqual({});
  });

  it('lowers when an override is below the current effective level, and not for inherit or a raise', () => {
    const effective = draftFromGrants({ members: 'write', stats: 'read', projects: 'manage' });

    expect(
      loweredOverrides(effective, { members: 'read', stats: 'write', audit: 'read' })
    ).toEqual(['members']);
    expect(loweredOverrides(effective, { messages: 'none' })).toEqual([]);
    expect(loweredOverrides(effective, { projects: 'none' })).toEqual(['projects']);
    expect(loweredOverrides(effective, {})).toEqual([]);
  });
});
```

Create `apps/web/tests/shared/lib/reachability.test.ts`:

```ts
import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import type { Permissions } from '@/shared/lib/access';
import { describeUnreachable, unreachableGrants } from '@/shared/lib/reachability';

const levels = (granted: Partial<Permissions>): Permissions =>
  ({
    ...Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'none'])),
    ...granted,
  }) as Permissions;

describe('unreachableGrants', () => {
  it('finds nothing for a grant that has a page of its own', () => {
    expect(unreachableGrants(levels({ members: 'read', stats: 'read' }))).toEqual([]);
    expect(unreachableGrants(levels({ servers: 'read', sync: 'manage' }))).toEqual([]);
    expect(unreachableGrants(levels({ settings: 'read', audit: 'read' }))).toEqual([]);
  });

  it('flags a server-scoped grant without servers:read and names what is missing', () => {
    const result = unreachableGrants(levels({ channels: 'read' }));
    expect(result).toEqual([{ resource: 'channels', missing: [{ resource: 'servers', level: 'read' }] }]);
    expect(describeUnreachable(result[0]!)).toBe(
      'Channels needs Servers: read to be reachable in the panel'
    );
  });

  it('needs statistics as well as servers for roles', () => {
    const result = unreachableGrants(levels({ servers: 'read', roles: 'read' }));
    expect(result).toEqual([{ resource: 'roles', missing: [{ resource: 'stats', level: 'read' }] }]);
  });

  it('flags webhooks and project keys without projects:read', () => {
    const result = unreachableGrants(levels({ webhooks: 'read', project_keys: 'read' }));
    expect(result.map((entry) => entry.resource)).toEqual(['project_keys', 'webhooks']);
    expect(result.every((entry) => entry.missing.some((m) => m.resource === 'projects'))).toBe(true);
  });

  it('needs channels and servers for messages', () => {
    const result = unreachableGrants(levels({ messages: 'read' }));
    expect(result[0]?.resource).toBe('messages');
    expect(result[0]?.missing.map((m) => m.resource).sort()).toEqual(['channels', 'servers']);

    expect(unreachableGrants(levels({ messages: 'read', channels: 'read', servers: 'read' }))).toEqual([]);
  });

  it('ignores resources the member holds nothing on', () => {
    expect(unreachableGrants(levels({}))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/lib tests/shared/lib/reachability.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: The grants helpers**

Create `apps/web/src/features/access/lib/grants.ts`:

```ts
import {
  ACCESS_RESOURCES,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '@mcdi/contracts';

import type { MemberOverridesMap, RoleGrantsDto } from '@/features/access/types';

/** A level for every resource: what a role editor edits. */
export type Draft = Record<AccessResource, AccessLevel>;

/** A resource missing from the map is inherited: what a member editor edits. */
export type OverrideDraft = MemberOverridesMap;

export function draftFromGrants(grants: RoleGrantsDto): Draft {
  return Object.fromEntries(
    ACCESS_RESOURCES.map((resource) => [resource, grants[resource] ?? 'none'])
  ) as Draft;
}

/** The body of the role PUT: a resource set to none has no grant, so it is left out. */
export function grantsPayload(draft: Draft): RoleGrantsDto {
  const payload: RoleGrantsDto = {};
  for (const resource of ACCESS_RESOURCES) {
    const level = draft[resource];
    if (level !== 'none') payload[resource] = level as GrantLevel;
  }
  return payload;
}

export function isDirty(saved: Draft, draft: Draft): boolean {
  return ACCESS_RESOURCES.some((resource) => saved[resource] !== draft[resource]);
}

function isLower(next: AccessLevel, current: AccessLevel): boolean {
  return next !== current && levelAtLeast(current, next);
}

/** The resources whose level goes down: a save that includes any of them asks first. */
export function loweredResources(before: Draft, after: Draft): AccessResource[] {
  return ACCESS_RESOURCES.filter((resource) => isLower(after[resource], before[resource]));
}

/** The body of the member PUT. Inherited resources are not in it. */
export function overridesPayload(draft: OverrideDraft): MemberOverridesMap {
  const payload: MemberOverridesMap = {};
  for (const resource of ACCESS_RESOURCES) {
    const level = draft[resource];
    if (level !== undefined) payload[resource] = level;
  }
  return payload;
}

/** The resources whose override is below what the member holds now. Inheriting is never lowering. */
export function loweredOverrides(effective: Draft, draft: OverrideDraft): AccessResource[] {
  return ACCESS_RESOURCES.filter((resource) => {
    const level = draft[resource];
    return level !== undefined && isLower(level, effective[resource]);
  });
}
```

- [ ] **Step 4: Reachability**

Create `apps/web/src/shared/lib/reachability.ts`:

```ts
import { ACCESS_RESOURCES, type AccessResource, type GrantLevel } from '@mcdi/contracts';

import {
  allOf,
  canAccess,
  need,
  type AccessSubject,
  type Permissions,
  type Requirement,
} from '@/shared/lib/access';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';
import { ROUTE_RULES } from '@/shared/lib/route-access';

interface Leaf {
  resource: AccessResource;
  level: GrantLevel;
}

export interface UnreachableGrant {
  resource: AccessResource;
  /** What the member lacks for the grant to be usable in the panel. */
  missing: Leaf[];
}

/** Sections that make a resource usable but are not pages of their own in the route table. */
const EXTRA_USES: Array<{ resource: AccessResource; requires: Requirement }> = [
  {
    resource: 'messages',
    requires: allOf(need('servers', 'read'), need('channels', 'read'), need('messages', 'read')),
  },
  { resource: 'project_keys', requires: allOf(need('projects', 'read'), need('project_keys', 'read')) },
  { resource: 'settings', requires: need('settings', 'read') },
];

function leaves(requirement: Requirement): Leaf[] {
  switch (requirement.kind) {
    case 'permission':
      return [{ resource: requirement.resource, level: requirement.level }];
    case 'all':
    case 'any':
      return requirement.of.flatMap(leaves);
    default:
      return [];
  }
}

const USES: Array<{ requires: Requirement; resources: Set<AccessResource> }> = [
  ...ROUTE_RULES.map((rule) => rule.requires),
  ...EXTRA_USES.map((use) => use.requires),
].map((requires) => ({ requires, resources: new Set(leaves(requires).map((leaf) => leaf.resource)) }));

/**
 * The grants a member holds that no page or section can use, because a prerequisite is missing: a
 * server page needs `servers:read` for the server switcher, a role page needs statistics, and so on.
 * The API still allows such a grant; this only warns root that it has no effect in the panel.
 */
export function unreachableGrants(levels: Permissions): UnreachableGrant[] {
  const subject: AccessSubject = { root: false, permissions: levels };

  return ACCESS_RESOURCES.flatMap((resource) => {
    if (levels[resource] === 'none') return [];

    const candidates = USES.filter((use) => use.resources.has(resource));
    if (candidates.some((use) => canAccess(subject, use.requires))) return [];

    // The page that is closest to being usable: the fewest missing permissions.
    const options = candidates.map((use) =>
      leaves(use.requires).filter(
        (leaf, index, all) =>
          all.findIndex((other) => other.resource === leaf.resource && other.level === leaf.level) ===
            index && !canAccess(subject, need(leaf.resource, leaf.level))
      )
    );
    const missing = options.sort((a, b) => a.length - b.length)[0] ?? [];
    return [{ resource, missing }];
  });
}

export function describeUnreachable(grant: UnreachableGrant): string {
  const needs = grant.missing
    .map((leaf) => `${RESOURCE_TITLES[leaf.resource]}: ${leaf.level}`)
    .join(' and ');
  return `${RESOURCE_TITLES[grant.resource]} needs ${needs} to be reachable in the panel`;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/lib tests/shared/lib/reachability.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/src/features/access/lib apps/web/src/shared/lib/reachability.ts apps/web/tests/features/access/lib apps/web/tests/shared/lib/reachability.test.ts
git add apps/web
git commit -m "feat(web): add grant drafts, lowering detection and panel reachability hints"
```

---

### Task 5: The level control and the role editor

**Files:**
- Create: `apps/web/src/features/access/components/LevelControl.tsx`, `RoleEditor.tsx`
- Test: `apps/web/tests/features/access/components/role-editor.test.tsx`

**Interfaces:**
- Consumes: Tasks 3 and 4, `RESOURCE_TITLES`, `ConfirmDialog`, `Button`, `Badge`, `useToastStore`.
- Produces: `LevelControl` (props `name`, `label`, `description?`, `value`, `options`, `onChange`, `disabled?`, `hint?`), `RoleEditor` (props `role: AccessRoleDto`, `catalog: AccessCatalogDto`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/access/components/role-editor.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ACCESS_LEVELS, ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { RoleEditor } from '@/features/access/components/RoleEditor';
import type { AccessCatalogDto, AccessRoleDto } from '@/features/access';

const API = 'http://localhost:3000/api';

const catalog: AccessCatalogDto = {
  resources: ACCESS_RESOURCES.map((key) => ({ key, description: `About ${key}` })),
  levels: ACCESS_LEVELS.map((key) => ({ key, description: key })),
};

const role = (overrides: Partial<AccessRoleDto> = {}): AccessRoleDto => ({
  id: 'r-hr',
  name: 'HR',
  position: 3,
  root: false,
  grants: { members: 'read', audit: 'read' },
  ...overrides,
});

function renderEditor(value: AccessRoleDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<RoleEditor role={value} catalog={catalog} />, { wrapper });
}

const level = (resource: string, name: string) =>
  within(screen.getByRole('group', { name: resource })).getByRole('radio', { name });

describe('RoleEditor', () => {
  it('shows one control per resource with the role grants and the catalog description', () => {
    renderEditor(role());

    expect(level('Members', 'Read')).toBeChecked();
    expect(level('Messages', 'None')).toBeChecked();
    expect(screen.getByText('About members')).toBeInTheDocument();
    expect(screen.getAllByRole('group').length).toBe(ACCESS_RESOURCES.length);
  });

  it('locks a root role', () => {
    renderEditor(role({ root: true, grants: {} }));

    expect(screen.getByText(/full access/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('saves the full set without none, then reports it', async () => {
    let body: unknown;
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ roleId: 'r-hr', grants: {} });
      })
    );
    renderEditor(role());

    await userEvent.click(level('Projects', 'Write'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(body).toEqual({ grants: { members: 'read', audit: 'read', projects: 'write' } }));
  });

  it('keeps Save off until something changes, and Discard puts the form back', async () => {
    renderEditor(role());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

    await userEvent.click(level('Projects', 'Read'));
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(level('Projects', 'None')).toBeChecked();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('asks before lowering a level and sends nothing until confirmed', async () => {
    let saved = false;
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, () => {
        saved = true;
        return HttpResponse.json({ roleId: 'r-hr', grants: {} });
      })
    );
    renderEditor(role());

    await userEvent.click(level('Members', 'None'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/lose this access immediately/i)).toBeInTheDocument();
    expect(saved).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /^save changes$/i }));
    await waitFor(() => expect(saved).toBe(true));
  });

  it('does not ask when only raising a level', async () => {
    let saved = false;
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, () => {
        saved = true;
        return HttpResponse.json({ roleId: 'r-hr', grants: {} });
      })
    );
    renderEditor(role());

    await userEvent.click(level('Members', 'Manage'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(saved).toBe(true));
    expect(screen.queryByText(/lose this access immediately/i)).not.toBeInTheDocument();
  });

  it('warns about a grant that cannot be reached in the panel', async () => {
    renderEditor(role({ grants: { channels: 'read' } }));
    expect(screen.getByText('Channels needs Servers: read to be reachable in the panel')).toBeInTheDocument();

    await userEvent.click(level('Servers', 'Read'));
    expect(screen.queryByText(/needs Servers: read/)).not.toBeInTheDocument();
  });

  it('shows the API message and keeps the form when a save is refused', async () => {
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, () =>
        HttpResponse.json({ message: 'Unknown resource', statusCode: 400 }, { status: 400 })
      )
    );
    renderEditor(role());

    await userEvent.click(level('Projects', 'Read'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(level('Projects', 'Read')).toBeChecked());
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/components/role-editor.test.tsx`
Expected: FAIL, components not found.

- [ ] **Step 3: The level control**

Create `apps/web/src/features/access/components/LevelControl.tsx`:

```tsx
'use client';

import { cn } from '@/shared/lib/utils';

export interface LevelOption<V extends string> {
  value: V;
  label: string;
}

interface LevelControlProps<V extends string> {
  /** Radio group name: unique per control on the page. */
  name: string;
  label: string;
  description?: string;
  /** A warning shown under the control. */
  hint?: string;
  value: V;
  options: LevelOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
}

/** A segmented control built on native radios: labelled group, arrow keys and focus come for free. */
export function LevelControl<V extends string>({
  name,
  label,
  description,
  hint,
  value,
  options,
  onChange,
  disabled = false,
}: LevelControlProps<V>) {
  return (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-col gap-2 border-0 p-0 py-3 first:pt-0 last:pb-0"
    >
      <legend className="float-left w-full text-body text-text-primary">{label}</legend>
      {description ? (
        <p className="clear-both text-overline text-text-subtle">{description}</p>
      ) : (
        <span className="clear-both" />
      )}
      <div className="inline-flex w-fit max-w-full flex-wrap rounded-md border border-border bg-surface-base p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-sm px-3 py-1.5 text-body transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border-focus',
              'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
              value === option.value
                ? 'bg-surface-active text-text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? <p className="text-overline text-warning">{hint}</p> : null}
    </fieldset>
  );
}
```

- [ ] **Step 4: The role editor**

Create `apps/web/src/features/access/components/RoleEditor.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';

import { useSetRoleGrantsMutation } from '@/features/access/api/mutations';
import { LevelControl, type LevelOption } from '@/features/access/components/LevelControl';
import {
  draftFromGrants,
  grantsPayload,
  isDirty,
  loweredResources,
  type Draft,
} from '@/features/access/lib/grants';
import type { AccessCatalogDto, AccessRoleDto } from '@/features/access/types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';
import { describeUnreachable, unreachableGrants } from '@/shared/lib/reachability';
import { useToastStore } from '@/shared/stores/toast';

const OPTIONS: LevelOption<Draft[keyof Draft]>[] = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'manage', label: 'Manage' },
];

/**
 * The grants of one role: a level per resource. Mount it with `key={role.id}` so it restarts when
 * another role is picked. The save replaces every grant of the role in one request.
 */
export function RoleEditor({ role, catalog }: { role: AccessRoleDto; catalog: AccessCatalogDto }) {
  const showToast = useToastStore((state) => state.show);
  const mutation = useSetRoleGrantsMutation();

  const saved = useMemo(() => draftFromGrants(role.grants), [role.grants]);
  const [edits, setEdits] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const draft = edits ?? saved;

  const dirty = isDirty(saved, draft);
  const lowered = loweredResources(saved, draft);
  const hints = useMemo(
    () => new Map(unreachableGrants(draft).map((grant) => [grant.resource, describeUnreachable(grant)])),
    [draft]
  );

  if (role.root) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-text-muted" aria-hidden="true" />
          <h2 className="text-heading text-text-primary">{role.name}</h2>
          <Badge variant="secondary">Root</Badge>
        </div>
        <p className="text-body text-text-muted">
          A root role holds full access to everything. It is set by the API configuration and
          cannot be edited here.
        </p>
      </section>
    );
  }

  function save() {
    mutation.mutate(
      { roleId: role.id, grants: grantsPayload(draft) },
      {
        onSuccess: () => {
          setEdits(null);
          setConfirming(false);
          showToast('Grants saved', 'success');
        },
        onError: (error) => {
          setConfirming(false);
          showToast(error.message || 'Failed to save the grants', 'error');
        },
      }
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading text-text-primary">{role.name}</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => setEdits(null)}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => (lowered.length > 0 ? setConfirming(true) : save())}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {catalog.resources.map((resource) => (
          <LevelControl
            key={resource.key}
            name={`${role.id}-${resource.key}`}
            label={RESOURCE_TITLES[resource.key]}
            description={resource.description}
            hint={hints.get(resource.key)}
            value={draft[resource.key]}
            options={OPTIONS}
            onChange={(next) => setEdits({ ...draft, [resource.key]: next })}
            disabled={mutation.isPending}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        title="Lower this role’s access?"
        description={`Members with this role lose this access immediately: ${lowered
          .map((resource) => RESOURCE_TITLES[resource])
          .join(', ')}.`}
        confirmLabel="Save changes"
        isConfirming={mutation.isPending}
        onConfirm={save}
      />
    </section>
  );
}
```

- [ ] **Step 5: Run the tests and commit**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/components/role-editor.test.tsx`
Expected: PASS. If a test cannot find the confirm dialog's text or button because the dialog renders in a portal, query through `screen` (already used) and confirm the button label matches `confirmLabel`.

```bash
pnpm exec prettier --write apps/web/src/features/access/components apps/web/tests/features/access/components
git add apps/web
git commit -m "feat(web): add the level control and the role editor"
```

---

### Task 6: The Access screen (roles and members with overrides)

**Files:**
- Create: `apps/web/src/features/access/components/RoleList.tsx`, `MemberChip.tsx`, `OverridesList.tsx`
- Create: `apps/web/src/app/dashboard/access/page.tsx`, `apps/web/src/app/dashboard/access/access-view.tsx`
- Modify: `apps/web/src/shared/lib/route-access.ts`, `apps/web/src/shared/components/layout/nav-items.ts`
- Test: `apps/web/tests/features/access/components/overrides-list.test.tsx`, `apps/web/tests/app/dashboard/access.test.tsx`; update `tests/shared/components/layout/visible-nav.test.ts`, `tests/shared/components/layout/nav-items.test.ts`, `tests/shared/components/layout/use-breadcrumb-items.test.ts` where they list the System group

**Interfaces:**
- Consumes: Tasks 3 to 5.
- Produces: `RoleList` (props `roles`, `selectedId`, `onSelect`), `MemberChip` (props `displayName`, `username`, `avatar`), `OverridesList` (prop `members: OverrideMemberDto[]`), the `AccessView` client component, route table entries for `/dashboard/access` and `/dashboard/members/[discordId]/access` (both `ROOT_ONLY`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/features/access/components/overrides-list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OverridesList } from '@/features/access/components/OverridesList';
import type { OverrideMemberDto } from '@/features/access';

const member = (overrides: Partial<OverrideMemberDto> = {}): OverrideMemberDto => ({
  memberId: 'm1',
  username: 'ada',
  displayName: 'Ada',
  avatar: null,
  root: false,
  overrides: { messages: 'none', projects: 'manage' },
  ...overrides,
});

describe('OverridesList', () => {
  it('summarizes each member and links to their Access page', () => {
    render(<OverridesList members={[member()]} />);

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Messages: none')).toBeInTheDocument();
    expect(screen.getByText('Projects: manage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ada/i })).toHaveAttribute(
      'href',
      '/dashboard/members/m1/access'
    );
  });

  it('marks overrides that are inactive because the member is root now', () => {
    render(<OverridesList members={[member({ root: true })]} />);
    expect(screen.getByText(/inactive while root/i)).toBeInTheDocument();
  });

  it('says so when nobody has an override', () => {
    render(<OverridesList members={[]} />);
    expect(screen.getByText(/no member has an override/i)).toBeInTheDocument();
  });
});
```

Create `apps/web/tests/app/dashboard/access.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACCESS_LEVELS, ACCESS_RESOURCES } from '@mcdi/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { AccessView } from '@/app/dashboard/access/access-view';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockAccess() {
  server.use(
    http.get(`${API}/admin/access/catalog`, () =>
      HttpResponse.json({
        resources: ACCESS_RESOURCES.map((key) => ({ key, description: `About ${key}` })),
        levels: ACCESS_LEVELS.map((key) => ({ key, description: key })),
      })
    ),
    http.get(`${API}/admin/access/roles`, () =>
      HttpResponse.json([
        { id: 'r-exec', name: 'Executive', position: 9, root: true, grants: {} },
        { id: 'r-hr', name: 'HR', position: 3, root: false, grants: { members: 'read' } },
        { id: 'r-dev', name: 'Dev Member', position: 2, root: false, grants: { projects: 'write' } },
      ])
    ),
    http.get(`${API}/admin/access/overrides`, () =>
      HttpResponse.json({
        members: [
          { memberId: 'm1', username: 'ada', displayName: 'Ada', avatar: null, root: false, overrides: { messages: 'none' } },
        ],
      })
    )
  );
}

describe('AccessView', () => {
  it('lists the roles, marks the root ones, and edits the selected one', async () => {
    mockAccess();
    render(<AccessView />, { wrapper });

    const list = await screen.findByRole('list', { name: 'Roles' });
    expect(within(list).getByText('Executive')).toBeInTheDocument();
    expect(within(list).getByText('Root')).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: /HR/ }));
    expect(
      within(screen.getByRole('group', { name: 'Members' })).getByRole('radio', { name: 'Read' })
    ).toBeChecked();

    await userEvent.click(within(list).getByRole('button', { name: /Executive/ }));
    expect(screen.getByText(/cannot be edited here/i)).toBeInTheDocument();
  });

  it('shows the members with overrides on the second tab', async () => {
    mockAccess();
    render(<AccessView />, { wrapper });

    await userEvent.click(await screen.findByRole('tab', { name: /members with overrides/i }));
    expect(await screen.findByText('Messages: none')).toBeInTheDocument();
  });

  it('shows a retry when the roles cannot be loaded', async () => {
    mockAccess();
    server.use(
      http.get(`${API}/admin/access/roles`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    render(<AccessView />, { wrapper });

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Roles' })).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/components/overrides-list.test.tsx tests/app/dashboard/access.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: The member chip, the role list and the overrides list**

Create `apps/web/src/features/access/components/MemberChip.tsx`:

```tsx
import { MemberAvatar } from '@/features/members/components/MemberAvatar';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return letters.map((part) => part?.[0]?.toUpperCase() ?? '').join('') || '?';
}

/** A member's avatar, name and username, for lists and page headers. */
export function MemberChip({
  displayName,
  username,
  avatar,
}: {
  displayName: string;
  username: string;
  avatar: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar
        displayName={displayName}
        avatarUrl={avatar}
        avatarInitials={initials(displayName)}
      />
      <div className="min-w-0">
        <div className="truncate text-subhead text-text-primary">{displayName}</div>
        <div className="truncate text-overline text-text-faint">@{username}</div>
      </div>
    </div>
  );
}
```

Create `apps/web/src/features/access/components/RoleList.tsx`:

```tsx
'use client';

import { Lock } from 'lucide-react';

import type { AccessRoleDto } from '@/features/access/types';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

interface RoleListProps {
  roles: AccessRoleDto[];
  selectedId: string | null;
  onSelect: (roleId: string) => void;
}

/** The main server's roles in Discord order. Root roles carry a lock. */
export function RoleList({ roles, selectedId, onSelect }: RoleListProps) {
  const ordered = [...roles].sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

  return (
    <ul
      aria-label="Roles"
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised"
    >
      {ordered.map((role) => (
        <li key={role.id} className="border-b border-border last:border-b-0">
          <button
            type="button"
            aria-current={selectedId === role.id ? 'true' : undefined}
            onClick={() => onSelect(role.id)}
            className={cn(
              'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-body transition-colors',
              selectedId === role.id
                ? 'bg-surface-active text-text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
            )}
          >
            <span className="truncate">{role.name}</span>
            {role.root ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden="true" />
                <Badge variant="secondary">Root</Badge>
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

Create `apps/web/src/features/access/components/OverridesList.tsx`:

```tsx
'use client';

import Link from 'next/link';

import { MemberChip } from '@/features/access/components/MemberChip';
import type { OverrideMemberDto } from '@/features/access/types';
import { Badge } from '@/shared/components/ui/badge';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';

/** Every member who has overrides, with a summary and a link to their Access page. */
export function OverridesList({ members }: { members: OverrideMemberDto[] }) {
  if (members.length === 0) {
    return <p className="text-body text-text-muted">No member has an override.</p>;
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised">
      {members.map((member) => (
        <li key={member.memberId} className="border-b border-border last:border-b-0">
          <Link
            href={`/dashboard/members/${encodeURIComponent(member.memberId)}/access`}
            aria-label={`${member.displayName}, open Access`}
            className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between"
          >
            <MemberChip
              displayName={member.displayName}
              username={member.username}
              avatar={member.avatar}
            />
            <div className="flex flex-wrap items-center gap-2">
              {member.root ? <Badge variant="warning">Inactive while root</Badge> : null}
              {Object.entries(member.overrides).map(([resource, level]) => (
                <Badge key={resource} variant="outline">
                  {`${RESOURCE_TITLES[resource as keyof typeof RESOURCE_TITLES]}: ${level}`}
                </Badge>
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

(If `Badge` has no `warning` variant, use `secondary`; check `badge.tsx` and pick an existing variant.)

- [ ] **Step 4: The screen**

Create `apps/web/src/app/dashboard/access/page.tsx`:

```tsx
import { AccessView } from '@/app/dashboard/access/access-view';

export default function AccessPage() {
  return <AccessView />;
}
```

Create `apps/web/src/app/dashboard/access/access-view.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import {
  useAccessCatalogQuery,
  useAccessRolesQuery,
  useOverridesListQuery,
} from '@/features/access';
import { OverridesList } from '@/features/access/components/OverridesList';
import { RoleEditor } from '@/features/access/components/RoleEditor';
import { RoleList } from '@/features/access/components/RoleList';
import { LoadingSkeleton } from '@/shared/components/common';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

function RolesTab() {
  const roles = useAccessRolesQuery();
  const catalog = useAccessCatalogQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (roles.isError || catalog.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load the roles"
        actionLabel="Retry"
        onAction={() => {
          void roles.refetch();
          void catalog.refetch();
        }}
      />
    );
  }
  if (!roles.data || !catalog.data) return <LoadingSkeleton className="h-96 rounded-lg" />;

  const selected =
    roles.data.find((role) => role.id === selectedId) ??
    [...roles.data].sort((a, b) => (b.position ?? 0) - (a.position ?? 0))[0] ??
    null;

  if (!selected) {
    return <EmptyState title="No roles" description="The main server has no roles yet." />;
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <RoleList roles={roles.data} selectedId={selected.id} onSelect={setSelectedId} />
      <RoleEditor key={selected.id} role={selected} catalog={catalog.data} />
    </div>
  );
}

function OverridesTab() {
  const overrides = useOverridesListQuery();

  if (overrides.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load the overrides"
        actionLabel="Retry"
        onAction={() => void overrides.refetch()}
      />
    );
  }
  if (!overrides.data) return <LoadingSkeleton className="h-48 rounded-lg" />;
  return <OverridesList members={overrides.data.members} />;
}

/** Who may do what in the admin API: role grants and per-person overrides. Root only. */
export function AccessView() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <p className="text-overline text-brand-light uppercase">System</p>
        <h1 className="mt-1 text-hero text-text-primary">Access</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          Give each role a level on every area of MCDI, and override it for one person when needed.
          Changes apply on the next request.
        </p>
      </header>

      <Tabs defaultValue="roles" className="flex flex-col gap-4">
        <TabsList aria-label="Access sections">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="overrides">Members with overrides</TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="overrides">
          <OverridesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 5: The route table and the sidebar**

In `apps/web/src/shared/lib/route-access.ts`: add `ROOT_ONLY` to the import from `@/shared/lib/access`, and add these two entries (after the `/dashboard/settings/inbound-webhooks` entry):

```ts
  { pattern: '/dashboard/access', requires: ROOT_ONLY },
  { pattern: '/dashboard/members/[discordId]/access', requires: ROOT_ONLY },
```

In `apps/web/src/shared/components/layout/nav-items.ts`: add `LockKeyhole` to the lucide import (alphabetical, after `LayoutDashboard`), and add to the System group's `items`, after Settings:

```ts
      { name: 'Access', route: '/dashboard/access', icon: LockKeyhole },
```

- [ ] **Step 6: Update the tests that list the System group**

Run `pnpm --filter @mcdi/web exec vitest run tests/shared`. For each failure that lists the System group, add `Access` after `Settings` for root. In `tests/shared/components/layout/visible-nav.test.ts` change the root expectation to `['System', ['Monitoring', 'Settings', 'Access'], undefined]` and add:

```ts
  it('shows Access to root only', () => {
    expect(names(member({ settings: 'manage', audit: 'manage' })).flat(2)).not.toContain('Access');
    expect(names(root).flat(2)).toContain('Access');
  });
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access tests/app/dashboard/access.test.tsx tests/shared`
Expected: PASS, including the route-table coverage test (it now finds the two new pages: create the member page in Task 7 before running this, or temporarily expect the test to fail on `/dashboard/members/[discordId]/access` until Task 7).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/src/app/dashboard/access apps/web/src/features/access apps/web/tests
git add apps/web
git commit -m "feat(web): add the Access screen for roles and members with overrides"
```

---

### Task 7: The member Access page

**Files:**
- Create: `apps/web/src/features/access/components/MemberAccessEditor.tsx`
- Create: `apps/web/src/app/dashboard/members/[discordId]/access/page.tsx`, `member-access-view.tsx`
- Modify: `apps/web/src/app/dashboard/members/[discordId]/page.tsx`
- Test: `apps/web/tests/features/access/components/member-access-editor.test.tsx`

**Interfaces:**
- Consumes: Tasks 3 to 5.
- Produces: `MemberAccessEditor` (prop `memberId: string`), `MemberAccessView` (prop `memberId`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/access/components/member-access-editor.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { MemberAccessEditor } from '@/features/access/components/MemberAccessEditor';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const effective = (root = false) => ({
  memberId: 'm1',
  username: 'ada',
  displayName: 'Ada',
  avatar: null,
  root,
  access: Object.fromEntries(
    ACCESS_RESOURCES.map((resource) => [
      resource,
      root
        ? { level: 'manage', source: { type: 'root' } }
        : resource === 'members'
          ? { level: 'write', source: { type: 'role', roleId: 'r-hr' } }
          : resource === 'messages'
            ? { level: 'read', source: { type: 'override' } }
            : { level: 'none', source: { type: 'none' } },
    ])
  ),
});

function mockMember(options: { root?: boolean; overrides?: Record<string, string> } = {}) {
  server.use(
    http.get(`${API}/admin/access/members/m1/effective`, () => HttpResponse.json(effective(options.root))),
    http.get(`${API}/admin/access/members/m1`, () =>
      HttpResponse.json({ memberId: 'm1', overrides: options.overrides ?? { messages: 'read' } })
    ),
    http.get(`${API}/admin/access/roles`, () =>
      HttpResponse.json([{ id: 'r-hr', name: 'HR', position: 3, root: false, grants: { members: 'write' } }])
    ),
    http.get(`${API}/admin/access/catalog`, () =>
      HttpResponse.json({
        resources: ACCESS_RESOURCES.map((key) => ({ key, description: `About ${key}` })),
        levels: [],
      })
    )
  );
}

const control = (resource: string, name: string) =>
  within(screen.getByRole('group', { name: resource })).getByRole('radio', { name });

describe('MemberAccessEditor', () => {
  it('shows the effective level with its source and the current overrides', async () => {
    mockMember();
    render(<MemberAccessEditor memberId="m1" />, { wrapper });

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText(/Effective: write · Role: HR/)).toBeInTheDocument();
    expect(screen.getByText(/Effective: read · Override/)).toBeInTheDocument();
    expect(control('Members', 'Inherit')).toBeChecked();
    expect(control('Messages', 'Read')).toBeChecked();
  });

  it('locks a member who is root', async () => {
    mockMember({ root: true });
    render(<MemberAccessEditor memberId="m1" />, { wrapper });

    expect(await screen.findByText(/cannot be changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('saves the full override set and leaves inherited resources out', async () => {
    let body: unknown;
    mockMember();
    server.use(
      http.put(`${API}/admin/access/members/m1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ memberId: 'm1', overrides: {} });
      })
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(control('Projects', 'Manage'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(body).toEqual({ grants: { messages: 'read', projects: 'manage' } }));
  });

  it('sends an empty set when every override is set back to inherit', async () => {
    let body: unknown;
    mockMember();
    server.use(
      http.put(`${API}/admin/access/members/m1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ memberId: 'm1', overrides: {} });
      })
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(control('Messages', 'Inherit'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(body).toEqual({ grants: {} }));
  });

  it('asks before setting an override below what the member holds now', async () => {
    let saved = false;
    mockMember();
    server.use(
      http.put(`${API}/admin/access/members/m1`, () => {
        saved = true;
        return HttpResponse.json({ memberId: 'm1', overrides: {} });
      })
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(control('Members', 'Read'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/lose this access immediately/i)).toBeInTheDocument();
    expect(saved).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /^save changes$/i }));
    await waitFor(() => expect(saved).toBe(true));
  });

  it('shows a not-found state for an unknown member', async () => {
    server.use(
      http.get(`${API}/admin/access/members/m1/effective`, () =>
        HttpResponse.json({ message: 'Member not found' }, { status: 404 })
      ),
      http.get(`${API}/admin/access/members/m1`, () =>
        HttpResponse.json({ message: 'Member not found' }, { status: 404 })
      ),
      http.get(`${API}/admin/access/roles`, () => HttpResponse.json([])),
      http.get(`${API}/admin/access/catalog`, () => HttpResponse.json({ resources: [], levels: [] }))
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });

    expect(await screen.findByText(/member not found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access/components/member-access-editor.test.tsx`
Expected: FAIL, component not found.

- [ ] **Step 3: The member editor**

Create `apps/web/src/features/access/components/MemberAccessEditor.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Lock, SearchX } from 'lucide-react';

import {
  useAccessCatalogQuery,
  useAccessRolesQuery,
  useMemberEffectiveQuery,
  useMemberOverridesQuery,
} from '@/features/access/api/queries';
import { useSetMemberOverridesMutation } from '@/features/access/api/mutations';
import { LevelControl, type LevelOption } from '@/features/access/components/LevelControl';
import { MemberChip } from '@/features/access/components/MemberChip';
import {
  loweredOverrides,
  overridesPayload,
  type Draft,
  type OverrideDraft,
} from '@/features/access/lib/grants';
import type { EffectiveSourceDto } from '@/features/access/types';
import { LoadingSkeleton } from '@/shared/components/common';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';
import { describeUnreachable, unreachableGrants } from '@/shared/lib/reachability';
import { useToastStore } from '@/shared/stores/toast';
import type { ApiError } from '@/shared/types';

type Choice = 'inherit' | 'none' | 'read' | 'write' | 'manage';

const OPTIONS: LevelOption<Choice>[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'manage', label: 'Manage' },
];

function sourceLabel(source: EffectiveSourceDto, roleNames: Map<string, string>): string {
  switch (source.type) {
    case 'root':
      return 'Root';
    case 'override':
      return 'Override';
    case 'role':
      return `Role: ${roleNames.get(source.roleId) ?? source.roleId}`;
    case 'none':
      return 'No grant';
  }
}

/**
 * One member's access: the effective level per resource with where it comes from, and an override
 * for each. Inherit leaves a resource out of the save, because the API replaces the whole set.
 */
export function MemberAccessEditor({ memberId }: { memberId: string }) {
  const showToast = useToastStore((state) => state.show);
  const effective = useMemberEffectiveQuery(memberId);
  const overrides = useMemberOverridesQuery(memberId);
  const roles = useAccessRolesQuery();
  const catalog = useAccessCatalogQuery();
  const mutation = useSetMemberOverridesMutation(memberId);

  const [edits, setEdits] = useState<OverrideDraft | null>(null);
  const [confirming, setConfirming] = useState(false);

  const roleNames = useMemo(
    () => new Map((roles.data ?? []).map((role) => [role.id, role.name])),
    [roles.data]
  );
  const effectiveLevels = useMemo(
    () =>
      effective.data
        ? (Object.fromEntries(
            Object.entries(effective.data.access).map(([resource, entry]) => [resource, entry.level])
          ) as Draft)
        : null,
    [effective.data]
  );

  if (effective.isError || overrides.isError) {
    const notFound = ((effective.error ?? overrides.error) as unknown as ApiError | null)?.status === 404;
    return (
      <EmptyState
        icon={notFound ? SearchX : AlertCircle}
        title={notFound ? 'Member not found' : 'Couldn’t load this member’s access'}
        description={notFound ? 'The member may no longer exist.' : undefined}
        actionLabel={notFound ? undefined : 'Retry'}
        onAction={
          notFound
            ? undefined
            : () => {
                void effective.refetch();
                void overrides.refetch();
              }
        }
      />
    );
  }
  if (!effective.data || !overrides.data || !catalog.data || !effectiveLevels) {
    return <LoadingSkeleton className="h-96 rounded-lg" />;
  }

  const member = effective.data;
  const saved: OverrideDraft = overrides.data.overrides;
  const draft = edits ?? saved;
  const dirty = JSON.stringify(overridesPayload(draft)) !== JSON.stringify(overridesPayload(saved));
  const lowered = loweredOverrides(effectiveLevels, draft);
  const hints = new Map(
    unreachableGrants(effectiveLevels).map((grant) => [grant.resource, describeUnreachable(grant)])
  );

  const header = (
    <MemberChip displayName={member.displayName} username={member.username} avatar={member.avatar} />
  );

  if (member.root) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5">
        {header}
        <div className="flex items-center gap-2 text-body text-text-muted">
          <Lock className="size-4" aria-hidden="true" />
          Full access through a root role. It cannot be changed here.
        </div>
      </section>
    );
  }

  function save() {
    mutation.mutate(overridesPayload(draft), {
      onSuccess: () => {
        setEdits(null);
        setConfirming(false);
        showToast('Overrides saved', 'success');
      },
      onError: (error) => {
        setConfirming(false);
        showToast(error.message || 'Failed to save the overrides', 'error');
      },
    });
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {header}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => setEdits(null)}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => (lowered.length > 0 ? setConfirming(true) : save())}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {catalog.data.resources.map((resource) => {
          const entry = member.access[resource.key];
          return (
            <LevelControl<Choice>
              key={resource.key}
              name={`${memberId}-${resource.key}`}
              label={RESOURCE_TITLES[resource.key]}
              description={`Effective: ${entry.level} · ${sourceLabel(entry.source, roleNames)}`}
              hint={hints.get(resource.key)}
              value={draft[resource.key] ?? 'inherit'}
              options={OPTIONS}
              onChange={(next) => {
                const copy: OverrideDraft = { ...draft };
                if (next === 'inherit') delete copy[resource.key];
                else copy[resource.key] = next;
                setEdits(copy);
              }}
              disabled={mutation.isPending}
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        title="Lower this member’s access?"
        description={`They lose this access immediately: ${lowered
          .map((resource) => RESOURCE_TITLES[resource])
          .join(', ')}.`}
        confirmLabel="Save changes"
        isConfirming={mutation.isPending}
        onConfirm={save}
      />
    </section>
  );
}
```

(The test asserts "lose this access immediately", which the member dialog's description contains; the role dialog says "Members with this role lose this access immediately".)

- [ ] **Step 4: The page and the link from the member page**

Create `apps/web/src/app/dashboard/members/[discordId]/access/page.tsx`:

```tsx
import { MemberAccessView } from '@/app/dashboard/members/[discordId]/access/member-access-view';

export default async function MemberAccessPage({
  params,
}: {
  params: Promise<{ discordId: string }>;
}) {
  const { discordId } = await params;
  return <MemberAccessView memberId={discordId} />;
}
```

Create `apps/web/src/app/dashboard/members/[discordId]/access/member-access-view.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { MemberAccessEditor } from '@/features/access/components/MemberAccessEditor';
import { Button } from '@/shared/components/ui/button';

/** One member's access levels and overrides. Root only, and independent of the member detail page. */
export function MemberAccessView({ memberId }: { memberId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/dashboard/access">
            <ArrowLeft aria-hidden="true" />
            Access
          </Link>
        </Button>
        <h1 className="mt-2 text-hero text-text-primary">Member access</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          What this person can do, and where it comes from. An override replaces what their roles
          grant for that area, for this person only.
        </p>
      </div>
      <MemberAccessEditor memberId={memberId} />
    </div>
  );
}
```

In `apps/web/src/app/dashboard/members/[discordId]/page.tsx`: add `import Link from 'next/link';`, `import { ROOT_ONLY } from '@/shared/lib/access';`, `import { useCanAccess } from '@/shared/lib/use-access';`, add `const isRoot = useCanAccess(ROOT_ONLY);` after `const router = useRouter();`, and in the header row, between the "Back to members" button and the Refresh button, add:

```tsx
        <div className="flex items-center gap-2">
          {isRoot ? (
            <Button variant="secondary" asChild>
              <Link href={`/dashboard/members/${encodeURIComponent(discordId)}/access`}>Access</Link>
            </Button>
          ) : null}
          {/* the existing Refresh <Button> moves inside this div */}
        </div>
```

(Move the existing Refresh `<Button>` inside the new `div`, unchanged.)

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/access tests/app tests/shared`
Expected: PASS, including the route-table coverage test (the member Access page now exists) and the existing member page tests (the member page tests sign in root by default, so the Access link appears and does not disturb them; adjust a test that counts the header buttons if one does).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/src/app/dashboard/members apps/web/src/features/access apps/web/tests
git add apps/web
git commit -m "feat(web): add the member Access page"
```

---

### Task 8: Show `access` changes in the audit log filter

**Files:**
- Modify: `apps/web/src/features/monitoring/types/index.ts`, `apps/web/src/features/monitoring/components/AuditLogFilters.tsx`
- Test: `apps/web/tests/features/monitoring/…` (the existing audit filter test, or a new `audit-filters-access.test.tsx`)

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/monitoring/audit-filters-access.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuditLogFilters } from '@/features/monitoring/components/AuditLogFilters';

describe('AuditLogFilters', () => {
  it('offers the access action type', () => {
    render(<AuditLogFilters filters={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Access' })).toBeInTheDocument();
  });
});
```

(If the action types render as buttons or options instead of radios, query that role; the existing filter markup uses `type="radio"` inputs named `actionType`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/monitoring/audit-filters-access.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add the type**

In `features/monitoring/types/index.ts`, add `| 'access'` to `AuditActionType`:

```ts
export type AuditActionType =
  'auth' | 'project' | 'server' | 'role' | 'webhook' | 'member' | 'sync' | 'permission' | 'access';
```

In `AuditLogFilters.tsx`, add `{ value: 'access', label: 'Access' },` at the end of the `ACTIONS` array.

- [ ] **Step 4: Run the tests and commit**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/monitoring`
Expected: PASS.

```bash
pnpm exec prettier --write apps/web/src/features/monitoring apps/web/tests/features/monitoring
git add apps/web
git commit -m "feat(web): filter the audit log by access changes"
```

---

### Task 9: Docs, final verification and the pull request

**Files:**
- Modify: `apps/web/src/content/docs/build/web-guide.mdx`, `apps/web/src/content/docs/build/architecture.mdx`

- [ ] **Step 1: Document the screen**

In `apps/web/src/content/docs/build/web-guide.mdx`, after the paragraph about the access rules added in PR 1 (the point that starts "3. **The access rules**"), add:

```
4. **The Access screen** (`/dashboard/access`, root only) is where a root admin grants levels. The Roles tab edits one role at a time: a level per resource, saved as one request that replaces the role's grants. The Members with overrides tab lists everyone who has an override, and each member has an Access page (`/dashboard/members/[discordId]/access`) that shows the level they hold on every area, where it comes from, and lets root override it for that person alone. A save that lowers a level asks first, and a grant that cannot be reached in the panel because a prerequisite is missing (for example Channels without Servers) is flagged.
```

Add `` `apps/web/src/features/access` `` and `` `apps/web/src/app/dashboard/access` `` to that page's final `Source:` line. In `architecture.mdx`, in the admins paragraph, append the sentence: "The admin panel's Access screen edits grants through these endpoints, and the panel adds a root-only list of the members who have overrides, `GET /api/admin/access/overrides`." and add `` `apps/api/src/modules/admin-access` `` is already in its `Source:` line (nothing to add).

- [ ] **Step 2: Run the docs tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/docs`
Expected: PASS.

- [ ] **Step 3: Full verification**

```bash
pnpm typecheck
pnpm --filter @mcdi/web exec vitest run
pnpm --filter @mcdi/web run lint
pnpm --filter @mcdi/api exec jest --config jest.config.cjs --coverage
pnpm build
```

Run the API e2e suite in a subshell as in Task 2 Step 2, for the whole suite this time: `pnpm run test:e2e`. Expected: everything passes. Run `pnpm build` in a clean shell.

- [ ] **Step 4: Push and open the pull request to `dev`**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin benabdou/admin-panel-access
gh pr create --base dev --head benabdou/admin-panel-access \
  --title "feat: manage role grants and member overrides from the admin panel" \
  --body "## Summary
Third of three PRs for the panel. Design: \`docs/superpowers/specs/2026-10-07-admin-panel-access-design.md\`. Builds on the foundations PR (rules, route table, guard, sidebar).

A root-only **Access** screen to manage the permission system without Swagger or curl:
- **Roles tab:** the main server's roles, with root roles locked. The editor shows one control per area (none, read, write, manage) with its description, and one Save replaces the role's grants.
- **Members with overrides tab:** everyone who has an override, with a summary and a link to their page.
- **Member Access page** (\`/dashboard/members/[discordId]/access\`): the level a member holds on every area and where it comes from (root, a role, an override), with an override control per area (Inherit, none, read, write, manage). Root members are locked.
- A save that lowers a level asks first. A grant that cannot be reached in the panel for lack of a prerequisite (for example Channels without Servers) is flagged. The API's 400 and 404 messages show as toasts.
- The audit log filter gains the \`access\` type.

API additions (small): \`GET /api/admin/access/overrides\` (root only, not paginated, bounded by the club's size) and the member's name and avatar on \`GET .../members/:memberId/effective\`, so the page does not depend on the member detail page.

## Notes
- The member detail page (\`/dashboard/members/[discordId]\`) does not work against the real API: it calls \`GET /api/admin/members/:discordId\`, which does not exist, and its permissions panel calls an API-key-only endpoint. The new Access page does not depend on it; fixing it is separate work.

## Test plan
- [x] API: unit tests for the new service methods and controller, the route-classification test pins the new route, e2e for the overrides list (root only, root members flagged) and the profile on \`effective\`
- [x] Web: data layer, draft and lowering helpers, reachability hints, the level control, role editor (save, discard, confirm on lowering, hints, API errors), the overrides list, the screen and the member page
- [x] \`pnpm typecheck\`, \`pnpm build\`, web and API test suites, API reference regenerated"
```

Expected: the PR URL is printed. The commits and the PR body carry no Claude signature.
