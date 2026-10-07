# Admin Panel Foundations Implementation Plan (PR 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin panel the rules and the plumbing to adapt to the signed-in member's access levels: the shared catalog, the access data in the auth store, the rules library, the route table, a page guard that denies unmapped routes, a sidebar that shows only what the member can use, and a 403 refresh. Buttons, sections and queries are gated in the next PR.

**Architecture:** `GET /auth/admin/me` already returns `root` and a `permissions` map; the panel stores them with the user. One catalog (resources and levels) moves into `@mcdi/contracts` and is shared with the API. A pure rules library (`Requirement`, `canAccess`) and one route table drive the sidebar and a page guard that denies unmapped routes. `useCan` and `<Can>` gate sections and buttons, and every query hook is disabled when the member cannot read its resource. A 403 from the API invalidates the `/me` query.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Zustand, TanStack Query v5, Tailwind v4, Vitest + React Testing Library + MSW.

**Spec:** `docs/superpowers/specs/2026-10-07-admin-panel-access-design.md` (Part 1). Delivery is three PRs: this one (foundations), `docs/superpowers/plans/2026-10-07-admin-panel-gating.md` (gating of queries, sections and actions) and `docs/superpowers/plans/2026-10-07-admin-panel-access-screen.md` (the Access screen).

## Global Constraints

- The panel never enforces anything. The API is the only enforcement. The panel adapts to it, and the session cookie belongs to the API origin, so Next cannot read it. `proxy.ts` is not changed.
- Levels are `none < read < write < manage` and cumulative. Root passes every requirement (its `permissions` are `manage` throughout).
- Buttons and actions below the member's level are **hidden**, not disabled. A form the member can read but not change is rendered read-only with a "Read only" badge.
- A route with no entry in the route table is **denied**. A test fails when a `page.tsx` under `app/dashboard` has no entry.
- A query the member cannot make is **not sent**: every query hook is `enabled` only when the member can read its resource (the gating PR does this; in this PR only the rules and the helpers exist).
- Secondary data (a filter, a picker, a label, an extra card) degrades silently when the member cannot read it. Primary data is required by the route table.
- `/dashboard/settings` is open to every signed-in admin. Its profile section is always available; the gating PR restructures the rest of the page.
- Inbound webhook submissions are governed by the webhook's reader roles, not by levels. Do not gate `useSubmissionsQuery` or `useSubmissionQuery`, and do not gate the Submissions tab.
- Keep the code conventions of `apps/web/CLAUDE.md`: named exports only (except Next.js pages and layouts), `import type` for type-only imports, no `any`, `cn()` for conditional classes, design tokens (no hardcoded colors, no `dark:` classes), `lucide-react` icons, `@/` alias, tests only under `apps/web/tests`.
- Do not change the data in `nav-items.ts` (the docs excerpt the project sub-item lines); derive visibility from the route table instead. If a docs excerpt test fails after an edit, update the excerpt in `apps/web/src/content/docs/build/web-guide.mdx` to match.
- The existing web tests (1068) must keep passing. `tests/setup.ts` signs a root user in by default (Task 3), so a test that needs an anonymous or limited user says so explicitly.
- Commits and the PR carry no `Co-Authored-By` trailer and no Claude signature. Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`. The PR targets `dev`.
- Branch: `benabdou/admin-panel-foundations`, created from the latest `origin/dev`. This PR also carries the panel spec and the three plans under `docs/superpowers`.
- All commands run from the repository root `/Users/destockphonedz/Documents/MCDI/MCDI` unless a step says otherwise. Do not run `pnpm build` in a shell where `apps/api/.env` was sourced (it sets `NODE_ENV=development` and breaks `next build`). Run `pnpm exec prettier --write` and `pnpm exec eslint --fix` only on the files you changed.

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/access.ts` (create) | Resources, levels, ordering, guards, shared by API and web |
| `apps/api/src/common/permissions/catalog.ts` (modify) | Re-exports the shared catalog, keeps the descriptions |
| `apps/web/src/shared/lib/access.ts` (create) | `Requirement`, `canAccess`, `levelOf`, `hasAnyAccess` |
| `apps/web/src/shared/lib/access-labels.ts` (create) | Titles for resources and `describeRequirement` |
| `apps/web/src/shared/lib/use-access.ts` (create) | `useAccessSubject`, `useCan`, `useCanAccess`, `useLevel` |
| `apps/web/src/shared/components/common/Can.tsx` (create) | `<Can resource level fallback>` |
| `apps/web/src/shared/lib/route-access.ts` (create) | The route table and `requirementForPath` |
| `apps/web/src/shared/components/layout/visible-nav.ts` (create) | `visibleNavGroups`, `firstAllowedHref` |
| `apps/web/src/shared/components/layout/require-access.tsx`, `no-access.tsx` (create) | The page guard and the no-access states |
| `apps/web/src/shared/types/index.ts`, `features/auth/*` (modify) | `User` and `AdminProfileDto` carry `root` and `permissions` |
| `apps/web/src/shared/lib/api-client.ts`, `apps/web/src/providers/QueryProvider.tsx` (modify) | `setForbiddenHandler`, registered by the query provider |
| `apps/web/src/shared/components/layout/sidebar.tsx` (modify) | Shows only the links the member can use |
| `apps/web/tests/helpers/auth.ts`, `tests/setup.ts` | Test sign-in helpers and the default root user |
| `docs/superpowers/**` (create) | The panel spec and the three plans |

---

### Task 1: Move the catalog into `@mcdi/contracts`

**Files:**
- Create: `packages/contracts/src/access.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/common/permissions/catalog.ts`

**Interfaces:**
- Produces from `@mcdi/contracts`: `ACCESS_RESOURCES`, `AccessResource`, `ACCESS_LEVELS`, `AccessLevel`, `GRANT_LEVELS`, `GrantLevel`, `levelAtLeast(effective, required)`, `isAccessResource(v)`, `isAccessLevel(v)`, `isGrantLevel(v)`. The API's `catalog.ts` keeps exporting the same names plus `RESOURCE_DESCRIPTIONS` and `LEVEL_DESCRIPTIONS`.

The API's existing `catalog.spec.ts` (15 tests) and every API consumer of `catalog.ts` are the regression test for this move: nothing about behavior changes.

- [ ] **Step 1: Create the shared catalog**

Create `packages/contracts/src/access.ts`:

```ts
/**
 * The catalog of admin access, shared by the API and the admin panel. Every
 * admin endpoint declares one resource and one level from here.
 */
export const ACCESS_RESOURCES = [
  "servers",
  "members",
  "channels",
  "messages",
  "roles",
  "projects",
  "project_keys",
  "webhooks",
  "inbound_webhooks",
  "sync",
  "stats",
  "audit",
  "monitoring",
  "settings",
] as const;
export type AccessResource = (typeof ACCESS_RESOURCES)[number];

/** Ordered: each level includes everything below it. */
export const ACCESS_LEVELS = ["none", "read", "write", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** A level a role can be granted. `none` exists only as a member override (a deny). */
export type GrantLevel = Exclude<AccessLevel, "none">;
export const GRANT_LEVELS: readonly GrantLevel[] = ["read", "write", "manage"];

const RANK: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  manage: 3,
};

/** True when `effective` is at least `required` (none < read < write < manage). */
export function levelAtLeast(
  effective: AccessLevel,
  required: AccessLevel,
): boolean {
  return RANK[effective] >= RANK[required];
}

export function isAccessResource(value: unknown): value is AccessResource {
  return (
    typeof value === "string" &&
    (ACCESS_RESOURCES as readonly string[]).includes(value)
  );
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === "string" &&
    (ACCESS_LEVELS as readonly string[]).includes(value)
  );
}

export function isGrantLevel(value: unknown): value is GrantLevel {
  return isAccessLevel(value) && value !== "none";
}
```

In `packages/contracts/src/index.ts` add, keeping the alphabetical order of the other lines:

```ts
export * from "./access";
```

(as the first line, before `export * from "./admin";`).

- [ ] **Step 2: Point the API catalog at it**

In `apps/api/src/common/permissions/catalog.ts`, delete everything above the line `export const RESOURCE_DESCRIPTIONS` (the resources, levels, ranking, `levelAtLeast` and the three guards) and put these lines at the top of the file instead. Keep `RESOURCE_DESCRIPTIONS` and `LEVEL_DESCRIPTIONS` exactly as they are:

```ts
import {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  GRANT_LEVELS,
  isAccessLevel,
  isAccessResource,
  isGrantLevel,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '@mcdi/contracts';

export {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  GRANT_LEVELS,
  isAccessLevel,
  isAccessResource,
  isGrantLevel,
  levelAtLeast,
};
export type { AccessLevel, AccessResource, GrantLevel };

```

- [ ] **Step 3: Build contracts and run the API regression tests**

```bash
pnpm --filter @mcdi/contracts run build
pnpm --filter @mcdi/api run typecheck
pnpm --filter @mcdi/api exec jest src/common/permissions src/modules/admin-access src/common/guards src/modules/auth
```

Expected: build and typecheck pass, and all the API tests pass (the catalog spec still imports from `./catalog`).

- [ ] **Step 4: Commit**

```bash
git add packages/contracts apps/api/src/common/permissions/catalog.ts
git commit -m "refactor: share the admin access catalog through @mcdi/contracts"
```

---

### Task 2: The access rules library

**Files:**
- Create: `apps/web/src/shared/lib/access.ts`
- Create: `apps/web/src/shared/lib/access-labels.ts`
- Test: `apps/web/tests/shared/lib/access.test.ts`

**Interfaces:**
- Consumes: `ACCESS_RESOURCES`, `levelAtLeast`, `AccessLevel`, `AccessResource`, `GrantLevel` from `@mcdi/contracts`.
- Produces from `access.ts`: `Permissions`, `AccessSubject`, `Requirement`, `OPEN`, `ANY_ACCESS`, `ROOT_ONLY`, `need(resource, level)`, `allOf(...)`, `anyOf(...)`, `levelOf(subject, resource)`, `hasAnyAccess(subject)`, `canAccess(subject, requirement)`. From `access-labels.ts`: `RESOURCE_TITLES`, `describeRequirement(requirement)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/shared/lib/access.test.ts`:

```ts
import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import {
  ANY_ACCESS,
  OPEN,
  ROOT_ONLY,
  allOf,
  anyOf,
  canAccess,
  hasAnyAccess,
  levelOf,
  need,
  type AccessSubject,
  type Permissions,
} from '@/shared/lib/access';
import { describeRequirement } from '@/shared/lib/access-labels';

const none = Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'none'])) as Permissions;

function subject(permissions: Partial<Permissions> = {}, root = false): AccessSubject {
  return { root, permissions: { ...none, ...permissions } };
}

describe('levelOf', () => {
  it('is none for a signed-out visitor and for a missing resource', () => {
    expect(levelOf(null, 'members')).toBe('none');
    expect(levelOf({ root: false, permissions: {} as Permissions }, 'members')).toBe('none');
  });

  it('is manage everywhere for root, whatever the map says', () => {
    expect(levelOf(subject({}, true), 'messages')).toBe('manage');
  });
});

describe('hasAnyAccess', () => {
  it('is false with every level none, true with one above none, true for root', () => {
    expect(hasAnyAccess(null)).toBe(false);
    expect(hasAnyAccess(subject())).toBe(false);
    expect(hasAnyAccess(subject({ stats: 'read' }))).toBe(true);
    expect(hasAnyAccess(subject({}, true))).toBe(true);
  });
});

describe('canAccess', () => {
  it('refuses a signed-out visitor, even an open route', () => {
    expect(canAccess(null, OPEN)).toBe(false);
  });

  it('lets any signed-in admin through an open route', () => {
    expect(canAccess(subject(), OPEN)).toBe(true);
  });

  it('applies cumulative levels', () => {
    const manager = subject({ projects: 'manage' });
    expect(canAccess(manager, need('projects', 'read'))).toBe(true);
    expect(canAccess(manager, need('projects', 'write'))).toBe(true);
    expect(canAccess(manager, need('projects', 'manage'))).toBe(true);

    const writer = subject({ projects: 'write' });
    expect(canAccess(writer, need('projects', 'write'))).toBe(true);
    expect(canAccess(writer, need('projects', 'manage'))).toBe(false);

    expect(canAccess(subject({ projects: 'read' }), need('projects', 'write'))).toBe(false);
    expect(canAccess(subject(), need('projects', 'read'))).toBe(false);
  });

  it('lets root pass everything, including root-only', () => {
    const root = subject({}, true);
    expect(canAccess(root, ROOT_ONLY)).toBe(true);
    expect(canAccess(root, need('messages', 'manage'))).toBe(true);
    expect(canAccess(subject({ settings: 'manage' }), ROOT_ONLY)).toBe(false);
  });

  it('handles all of and any of', () => {
    const both = allOf(need('servers', 'read'), need('roles', 'read'));
    expect(canAccess(subject({ servers: 'read', roles: 'read' }), both)).toBe(true);
    expect(canAccess(subject({ servers: 'read' }), both)).toBe(false);

    const either = anyOf(need('monitoring', 'read'), need('audit', 'read'));
    expect(canAccess(subject({ audit: 'read' }), either)).toBe(true);
    expect(canAccess(subject(), either)).toBe(false);
  });

  it('handles anyAccess', () => {
    expect(canAccess(subject(), ANY_ACCESS)).toBe(false);
    expect(canAccess(subject({ sync: 'read' }), ANY_ACCESS)).toBe(true);
  });
});

describe('describeRequirement', () => {
  it('names the resource and level in words', () => {
    expect(describeRequirement(need('project_keys', 'write'))).toBe('Project API keys: write');
    expect(describeRequirement(ROOT_ONLY)).toBe('Root access');
    expect(describeRequirement(allOf(need('servers', 'read'), need('roles', 'read')))).toBe(
      'Servers: read and Roles: read'
    );
    expect(describeRequirement(anyOf(need('monitoring', 'read'), need('audit', 'read')))).toBe(
      'Monitoring: read or Audit log: read'
    );
    expect(describeRequirement(ANY_ACCESS)).toBe('Access to at least one area');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/lib/access.test.ts`
Expected: FAIL, cannot resolve `@/shared/lib/access`.

- [ ] **Step 3: Write the rules**

Create `apps/web/src/shared/lib/access.ts`:

```ts
import {
  ACCESS_RESOURCES,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '@mcdi/contracts';

export type Permissions = Record<AccessResource, AccessLevel>;

/** The part of a signed-in user the rules read. */
export interface AccessSubject {
  root: boolean;
  permissions: Permissions;
}

export type Requirement =
  | { kind: 'open' } // any signed-in admin
  | { kind: 'anyAccess' } // at least one resource above none
  | { kind: 'root' }
  | { kind: 'permission'; resource: AccessResource; level: GrantLevel }
  | { kind: 'all'; of: Requirement[] }
  | { kind: 'any'; of: Requirement[] };

export const OPEN: Requirement = { kind: 'open' };
export const ANY_ACCESS: Requirement = { kind: 'anyAccess' };
export const ROOT_ONLY: Requirement = { kind: 'root' };

export function need(resource: AccessResource, level: GrantLevel): Requirement {
  return { kind: 'permission', resource, level };
}

export function allOf(...of: Requirement[]): Requirement {
  return { kind: 'all', of };
}

export function anyOf(...of: Requirement[]): Requirement {
  return { kind: 'any', of };
}

export function levelOf(subject: AccessSubject | null, resource: AccessResource): AccessLevel {
  if (!subject) return 'none';
  if (subject.root) return 'manage';
  // A persisted user from before permissions existed has no map: treat it as no access.
  return subject.permissions?.[resource] ?? 'none';
}

export function hasAnyAccess(subject: AccessSubject | null): boolean {
  if (!subject) return false;
  return subject.root || ACCESS_RESOURCES.some((resource) => levelOf(subject, resource) !== 'none');
}

export function canAccess(subject: AccessSubject | null, requirement: Requirement): boolean {
  if (!subject) return false;
  switch (requirement.kind) {
    case 'open':
      return true;
    case 'anyAccess':
      return hasAnyAccess(subject);
    case 'root':
      return subject.root === true;
    case 'permission':
      return levelAtLeast(levelOf(subject, requirement.resource), requirement.level);
    case 'all':
      return requirement.of.every((part) => canAccess(subject, part));
    case 'any':
      return requirement.of.some((part) => canAccess(subject, part));
  }
}
```

Create `apps/web/src/shared/lib/access-labels.ts`:

```ts
import type { AccessResource } from '@mcdi/contracts';

import type { Requirement } from '@/shared/lib/access';

export const RESOURCE_TITLES: Record<AccessResource, string> = {
  servers: 'Servers',
  members: 'Members',
  channels: 'Channels',
  messages: 'Messages',
  roles: 'Roles',
  projects: 'Projects',
  project_keys: 'Project API keys',
  webhooks: 'Webhooks',
  inbound_webhooks: 'Inbound webhooks',
  sync: 'Sync',
  stats: 'Statistics',
  audit: 'Audit log',
  monitoring: 'Monitoring',
  settings: 'Settings',
};

/** A requirement in words, for the "you do not have access" page and the Access screen hints. */
export function describeRequirement(requirement: Requirement): string {
  switch (requirement.kind) {
    case 'open':
      return 'Any signed-in admin';
    case 'anyAccess':
      return 'Access to at least one area';
    case 'root':
      return 'Root access';
    case 'permission':
      return `${RESOURCE_TITLES[requirement.resource]}: ${requirement.level}`;
    case 'all':
      return requirement.of.map(describeRequirement).join(' and ');
    case 'any':
      return requirement.of.map(describeRequirement).join(' or ');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/lib/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/shared/lib/access.ts apps/web/src/shared/lib/access-labels.ts apps/web/tests/shared/lib/access.test.ts
git add apps/web/src/shared/lib apps/web/tests/shared/lib/access.test.ts
git commit -m "feat(web): add the access rules library"
```

---

### Task 3: `root` and `permissions` in the auth data, and the test sign-in helpers

**Files:**
- Modify: `apps/web/src/features/auth/types/index.ts`, `apps/web/src/features/auth/api/mappers.ts`, `apps/web/src/features/auth/api/queries.ts`, `apps/web/src/shared/types/index.ts`
- Create: `apps/web/tests/helpers/auth.ts`
- Modify: `apps/web/tests/setup.ts`
- Modify (fixtures): `tests/features/auth/api/mappers.test.ts` and every test file that builds a `User` or an `AdminProfileDto` (listed in Step 6)

**Interfaces:**
- Produces: `User.root: boolean`, `User.permissions: Permissions`, `AdminProfileDto.root`, `AdminProfileDto.permissions`; test helpers `NO_PERMISSIONS`, `ROOT_PERMISSIONS`, `permissionsWith(partial)`, `makeUser(overrides?)`, `makeProfile(overrides?)`, `signInAs({ root?, permissions? })`, `signInAsRoot()`, `signOut()`.

- [ ] **Step 1: Write the failing mapper test**

In `apps/web/tests/features/auth/api/mappers.test.ts`, add this test inside the existing `describe` (adapt the imports if the file already imports `mapAdminProfileToUser`; the DTO below carries every field of `AdminProfileDto`):

```ts
  it('carries root and the permissions map onto the user', () => {
    const permissions = Object.fromEntries(
      ACCESS_RESOURCES.map((resource) => [resource, resource === 'members' ? 'read' : 'none'])
    ) as Permissions;

    const user = mapAdminProfileToUser({
      id: '1',
      username: 'ada',
      globalName: null,
      displayName: null,
      avatar: null,
      email: null,
      isSystemAdmin: false,
      sessionExpiresAt: '2026-10-08T00:00:00.000Z',
      root: false,
      permissions,
    });

    expect(user.root).toBe(false);
    expect(user.permissions.members).toBe('read');
    expect(user.permissions.messages).toBe('none');
  });
```

and the imports `import { ACCESS_RESOURCES } from '@mcdi/contracts';` and `import type { Permissions } from '@/shared/lib/access';` at the top of that file.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/auth/api/mappers.test.ts`
Expected: FAIL (`user.root` is undefined).

- [ ] **Step 3: Carry the data through the types and mapper**

In `apps/web/src/features/auth/types/index.ts`, add to the imports `import type { Permissions } from '@/shared/lib/access';` and add these two fields to `AdminProfileDto`, after `sessionExpiresAt`:

```ts
  /** True when the member holds a root role: manage on every resource. */
  root: boolean;
  /** Effective level per admin resource. The panel adapts to it; the API enforces it. */
  permissions: Permissions;
```

In `apps/web/src/shared/types/index.ts`, add `import type { Permissions } from '@/shared/lib/access';` and add to `User` after `isSystemAdmin`:

```ts
  root: boolean;
  permissions: Permissions;
```

In `apps/web/src/features/auth/api/mappers.ts`, add to the returned object after `isSystemAdmin: dto.isSystemAdmin,`:

```ts
    root: dto.root,
    permissions: dto.permissions,
```

In `apps/web/src/features/auth/api/queries.ts`, change the query options: `staleTime: 5 * 60 * 1000,` becomes

```ts
    // A grant or revoke by a root admin reaches an open panel within a minute, or at once
    // when the API refuses a call (see `setForbiddenHandler`).
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
```

and update the doc comment of `useCurrentAdminQuery` with one sentence: "It also carries the member's effective access, so it is revalidated every minute and on window focus."

- [ ] **Step 4: Add the test helpers**

Create `apps/web/tests/helpers/auth.ts`:

```ts
import { ACCESS_RESOURCES } from '@mcdi/contracts';

import type { AdminProfileDto } from '@/features/auth/types';
import { useAuthStore } from '@/features/auth/stores/auth';
import type { Permissions } from '@/shared/lib/access';
import type { User } from '@/shared/types';

export const NO_PERMISSIONS = Object.fromEntries(
  ACCESS_RESOURCES.map((resource) => [resource, 'none'])
) as Permissions;

export const ROOT_PERMISSIONS = Object.fromEntries(
  ACCESS_RESOURCES.map((resource) => [resource, 'manage'])
) as Permissions;

/** Every resource `none` except the ones given. */
export function permissionsWith(levels: Partial<Permissions>): Permissions {
  return { ...NO_PERMISSIONS, ...levels };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    username: 'ada',
    name: 'Ada',
    email: 'ada@example.com',
    avatar: null,
    isSystemAdmin: false,
    root: true,
    permissions: ROOT_PERMISSIONS,
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<AdminProfileDto> = {}): AdminProfileDto {
  return {
    id: '1',
    username: 'ada',
    globalName: null,
    displayName: 'Ada',
    avatar: null,
    email: 'ada@example.com',
    isSystemAdmin: false,
    sessionExpiresAt: '2026-10-08T00:00:00.000Z',
    root: true,
    permissions: ROOT_PERMISSIONS,
    ...overrides,
  };
}

/**
 * Signs a user in the store. Pass `permissions` for a member with limited access
 * (`root` is then false unless given). Does not touch `isAuthenticated` or
 * `hasHydrated`: tests that need those set them themselves.
 */
export function signInAs(options: { root?: boolean; permissions?: Partial<Permissions> } = {}) {
  const root = options.root ?? options.permissions === undefined;
  const permissions = root ? ROOT_PERMISSIONS : permissionsWith(options.permissions ?? {});
  useAuthStore.setState({ user: makeUser({ root, permissions }) });
}

export function signInAsRoot() {
  signInAs({ root: true });
}

export function signOut() {
  useAuthStore.setState({ user: null });
}
```

- [ ] **Step 5: Sign a root user in by default**

In `apps/web/tests/setup.ts`, add `beforeEach` to the vitest import (`import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';`) and add after the `afterEach` block:

```ts
// Feature tests render with full access. A test that needs a limited or an anonymous user says so
// with `signInAs({ permissions })` or `signOut()` from `tests/helpers/auth.ts`.
beforeEach(async () => {
  const { signInAsRoot } = await import('./helpers/auth');
  signInAsRoot();
});
```

- [ ] **Step 6: Fix every fixture that builds a `User` or a profile**

These files build a `User` or an `AdminProfileDto` literal (found with `grep -rln isSystemAdmin apps/web/tests`). For each, replace the literal with `makeUser(...)` or `makeProfile(...)` from `@/../tests/helpers/auth` (use the relative path `../../helpers/auth` from the file, matching its depth), keeping any field the test asserts on as an override:

- `tests/features/settings/settings-flow.test.tsx`
- `tests/features/settings/components/settings-components.test.tsx`
- `tests/features/auth/stores/auth.test.ts`
- `tests/features/auth/components/SessionProvider.test.tsx`
- `tests/features/auth/api/mutations.test.tsx`
- `tests/features/auth/components/AuthCallbackHandler.test.tsx`
- `tests/features/auth/api/service.test.ts`
- `tests/features/members/api/queries.test.tsx`
- `tests/shared/components/layout/sidebar.test.tsx`
- `tests/lib/api-client.test.ts`

Where a test asserts the store starts without a user, add `signOut()` (from the helper) at its start.

- [ ] **Step 7: Run the whole web suite and fix what breaks**

Run: `pnpm --filter @mcdi/web run typecheck && pnpm --filter @mcdi/web exec vitest run`
Expected: typecheck passes and the suite passes. A failure is almost always a test that assumed `user === null` (add `signOut()`) or built a `User` without the new fields (use `makeUser`). Fix each, then re-run until green.

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write $(git diff --name-only -- apps/web) apps/web/tests/helpers/auth.ts
git add apps/web
git commit -m "feat(web): carry root and permissions in the auth data"
```

---

### Task 4: `useCan` and `<Can>`

**Files:**
- Create: `apps/web/src/shared/lib/use-access.ts`
- Create: `apps/web/src/shared/components/common/Can.tsx`
- Modify: `apps/web/src/shared/components/common/index.ts`
- Test: `apps/web/tests/shared/lib/use-access.test.tsx`, `apps/web/tests/shared/components/common/Can.test.tsx`

**Interfaces:**
- Consumes: Task 2 rules, Task 3 helpers.
- Produces: `useAccessSubject(): AccessSubject | null`, `useCan(resource, level): boolean`, `useCanAccess(requirement): boolean`, `useLevel(resource): AccessLevel`, `Can` (props `resource`, `level`, optional `fallback`, `children`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/shared/lib/use-access.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signInAs, signOut } from '../../helpers/auth';
import { need } from '@/shared/lib/access';
import { useAccessSubject, useCan, useCanAccess, useLevel } from '@/shared/lib/use-access';

describe('useCan', () => {
  it('follows the signed-in member', () => {
    signInAs({ permissions: { projects: 'write' } });

    expect(renderHook(() => useCan('projects', 'read')).result.current).toBe(true);
    expect(renderHook(() => useCan('projects', 'write')).result.current).toBe(true);
    expect(renderHook(() => useCan('projects', 'manage')).result.current).toBe(false);
    expect(renderHook(() => useCan('members', 'read')).result.current).toBe(false);
  });

  it('is true for root everywhere', () => {
    signInAs({ root: true });
    expect(renderHook(() => useCan('messages', 'manage')).result.current).toBe(true);
  });

  it('is false for everything when nobody is signed in', () => {
    signOut();
    expect(renderHook(() => useCan('projects', 'read')).result.current).toBe(false);
    expect(renderHook(() => useAccessSubject()).result.current).toBeNull();
  });
});

describe('useCanAccess and useLevel', () => {
  it('evaluates a requirement and reports the level', () => {
    signInAs({ permissions: { audit: 'read' } });
    expect(renderHook(() => useCanAccess(need('audit', 'read'))).result.current).toBe(true);
    expect(renderHook(() => useCanAccess(need('audit', 'write'))).result.current).toBe(false);
    expect(renderHook(() => useLevel('audit')).result.current).toBe('read');
    expect(renderHook(() => useLevel('sync')).result.current).toBe('none');
  });
});
```

Create `apps/web/tests/shared/components/common/Can.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signInAs } from '../../../helpers/auth';
import { Can } from '@/shared/components/common/Can';

describe('<Can>', () => {
  it('renders its children when the member reaches the level', () => {
    signInAs({ permissions: { servers: 'manage' } });
    render(
      <Can resource="servers" level="write">
        <button type="button">Add server</button>
      </Can>
    );
    expect(screen.getByRole('button', { name: 'Add server' })).toBeInTheDocument();
  });

  it('renders nothing, or the fallback, below the level', () => {
    signInAs({ permissions: { servers: 'read' } });
    const { rerender } = render(
      <Can resource="servers" level="write">
        <button type="button">Add server</button>
      </Can>
    );
    expect(screen.queryByRole('button', { name: 'Add server' })).not.toBeInTheDocument();

    rerender(
      <Can resource="servers" level="write" fallback={<span>Read only</span>}>
        <button type="button">Add server</button>
      </Can>
    );
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/lib/use-access.test.tsx tests/shared/components/common/Can.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/shared/lib/use-access.ts`:

```ts
'use client';

import { useMemo } from 'react';
import type { AccessLevel, AccessResource, GrantLevel } from '@mcdi/contracts';

import { useAuthStore } from '@/features/auth/stores/auth';
import {
  canAccess,
  levelOf,
  need,
  type AccessSubject,
  type Requirement,
} from '@/shared/lib/access';

/** The signed-in member's access, or null when nobody is signed in. */
export function useAccessSubject(): AccessSubject | null {
  const user = useAuthStore((state) => state.user);
  return useMemo(
    () => (user ? { root: user.root, permissions: user.permissions } : null),
    [user]
  );
}

export function useCanAccess(requirement: Requirement): boolean {
  const subject = useAccessSubject();
  return canAccess(subject, requirement);
}

/** Whether the member reaches `level` on `resource`. Levels are cumulative. */
export function useCan(resource: AccessResource, level: GrantLevel): boolean {
  return useCanAccess(need(resource, level));
}

export function useLevel(resource: AccessResource): AccessLevel {
  const subject = useAccessSubject();
  return levelOf(subject, resource);
}
```

Create `apps/web/src/shared/components/common/Can.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import type { AccessResource, GrantLevel } from '@mcdi/contracts';

import { useCan } from '@/shared/lib/use-access';

interface CanProps {
  resource: AccessResource;
  level: GrantLevel;
  /** Shown when the member is below `level`. Nothing by default. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders `children` only when the member reaches `level` on `resource`. */
export function Can({ resource, level, fallback = null, children }: CanProps) {
  return useCan(resource, level) ? <>{children}</> : <>{fallback}</>;
}
```

Open `apps/web/src/shared/components/common/index.ts` and add the line `export { Can } from './Can';` next to the other exports.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/lib/use-access.test.tsx tests/shared/components/common/Can.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/shared/lib/use-access.ts apps/web/src/shared/components/common/Can.tsx apps/web/tests/shared/lib/use-access.test.tsx apps/web/tests/shared/components/common/Can.test.tsx
git add apps/web
git commit -m "feat(web): add useCan and Can"
```

---

### Task 5: The route table

**Files:**
- Create: `apps/web/src/shared/lib/route-access.ts`
- Test: `apps/web/tests/shared/lib/route-access.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `ROUTE_RULES: RouteRule[]`, `requirementForPath(pathname: string): Requirement | null`.

Matching is exact on the path with `[param]` segments matching any one segment; when several patterns match (for example `.../inbound-webhooks/new` and `.../inbound-webhooks/[webhookId]`) the one with fewer dynamic segments wins. A path no pattern matches returns `null`, and the page guard treats that as denied.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/shared/lib/route-access.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ROUTE_RULES, requirementForPath } from '@/shared/lib/route-access';
import { ANY_ACCESS, ROOT_ONLY, allOf, need } from '@/shared/lib/access';

const DASHBOARD = path.resolve(__dirname, '../../../src/app/dashboard');

/** `/dashboard/servers/[id]/roles` for every `page.tsx` under `app/dashboard`. */
function pagePatterns(dir = DASHBOARD, prefix = '/dashboard'): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return pagePatterns(path.join(dir, entry.name), `${prefix}/${entry.name}`);
    return entry.name === 'page.tsx' ? [prefix] : [];
  });
}

describe('the route table', () => {
  it('has an entry for every dashboard page, and no stale entry', () => {
    const pages = pagePatterns().sort();
    const patterns = ROUTE_RULES.map((rule) => rule.pattern).sort();

    expect(pages.length).toBeGreaterThan(20);
    expect(patterns).toEqual(pages);
  });

  it('has no duplicate pattern', () => {
    const patterns = ROUTE_RULES.map((rule) => rule.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });
});

describe('requirementForPath', () => {
  it('matches a static page', () => {
    expect(requirementForPath('/dashboard/stats')).toEqual(need('stats', 'read'));
    expect(requirementForPath('/dashboard')).toEqual(ANY_ACCESS);
  });

  it('matches a dynamic page with any id, ignoring a trailing slash and a query', () => {
    expect(requirementForPath('/dashboard/servers/123/roles/456/')).toEqual(
      allOf(need('servers', 'read'), need('roles', 'read'), need('stats', 'read'))
    );
    expect(requirementForPath('/dashboard/projects/abc?tab=1')).toEqual(need('projects', 'read'));
  });

  it('prefers the more specific pattern', () => {
    expect(requirementForPath('/dashboard/projects/p1/inbound-webhooks/new')).toEqual(
      allOf(need('projects', 'read'), need('inbound_webhooks', 'write'))
    );
    expect(requirementForPath('/dashboard/projects/p1/inbound-webhooks/w1')).toEqual(
      allOf(need('projects', 'read'), need('inbound_webhooks', 'read'))
    );
  });

  it('returns null for a route that is not in the table', () => {
    expect(requirementForPath('/dashboard/nope')).toBeNull();
    expect(requirementForPath('/dashboard/servers/1/unknown')).toBeNull();
  });

  it('does not grant by prefix', () => {
    expect(requirementForPath('/dashboard/stats/extra')).toBeNull();
  });

  it('keeps the root-only pages root only', () => {
    // Added to the table by the Access screen (PR 3); this guards the helper itself.
    expect(ROOT_ONLY.kind).toBe('root');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/lib/route-access.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the table**

Create `apps/web/src/shared/lib/route-access.ts`:

```ts
import {
  ANY_ACCESS,
  OPEN,
  allOf,
  anyOf,
  need,
  type Requirement,
} from '@/shared/lib/access';

interface RouteRule {
  /** `/dashboard/servers/[id]/roles`: `[param]` matches any one segment. */
  pattern: string;
  requires: Requirement;
}

const servers = need('servers', 'read');
const projects = need('projects', 'read');

/**
 * Who may open each dashboard page. Opening a page needs `read`; the actions on it are gated where
 * they are rendered. A page that is not listed here is denied, and a test fails when a `page.tsx`
 * has no entry. Pages that read several resources list the ones that make up the page (`allOf`);
 * data that only feeds a filter or a label degrades on the page instead.
 */
export const ROUTE_RULES: RouteRule[] = [
  { pattern: '/dashboard', requires: ANY_ACCESS },

  { pattern: '/dashboard/members', requires: need('members', 'read') },
  { pattern: '/dashboard/members/[discordId]', requires: need('members', 'read') },
  { pattern: '/dashboard/stats', requires: need('stats', 'read') },

  { pattern: '/dashboard/servers', requires: servers },
  { pattern: '/dashboard/servers/[id]', requires: servers },
  { pattern: '/dashboard/servers/[id]/members', requires: allOf(servers, need('members', 'read')) },
  {
    pattern: '/dashboard/servers/[id]/roles',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  {
    pattern: '/dashboard/servers/[id]/roles/[roleId]',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  { pattern: '/dashboard/servers/[id]/channels', requires: allOf(servers, need('channels', 'read')) },
  { pattern: '/dashboard/servers/[id]/sync', requires: allOf(servers, need('sync', 'read')) },
  {
    pattern: '/dashboard/servers/[id]/sync/logs/[syncLogId]',
    requires: allOf(servers, need('sync', 'read')),
  },

  // Old links that redirect into the last-used server or project.
  { pattern: '/dashboard/roles', requires: allOf(servers, need('roles', 'read'), need('stats', 'read')) },
  {
    pattern: '/dashboard/roles/[roleId]',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  { pattern: '/dashboard/channels', requires: allOf(servers, need('channels', 'read')) },
  { pattern: '/dashboard/sync', requires: allOf(servers, need('sync', 'read')) },
  {
    pattern: '/dashboard/sync/logs/[syncLogId]',
    requires: allOf(servers, need('sync', 'read')),
  },
  { pattern: '/dashboard/webhooks', requires: allOf(projects, need('webhooks', 'read')) },

  { pattern: '/dashboard/projects', requires: projects },
  { pattern: '/dashboard/projects/[id]', requires: projects },
  { pattern: '/dashboard/projects/[id]/access', requires: allOf(projects, servers) },
  { pattern: '/dashboard/projects/[id]/webhooks', requires: allOf(projects, need('webhooks', 'read')) },
  {
    pattern: '/dashboard/projects/[id]/inbound-webhooks',
    requires: allOf(projects, need('inbound_webhooks', 'read')),
  },
  {
    pattern: '/dashboard/projects/[id]/inbound-webhooks/new',
    requires: allOf(projects, need('inbound_webhooks', 'write')),
  },
  {
    pattern: '/dashboard/projects/[id]/inbound-webhooks/[webhookId]',
    requires: allOf(projects, need('inbound_webhooks', 'read')),
  },

  { pattern: '/dashboard/monitoring', requires: anyOf(need('monitoring', 'read'), need('audit', 'read')) },

  // The profile is always available. Every other section is gated where it is rendered.
  { pattern: '/dashboard/settings', requires: OPEN },
  { pattern: '/dashboard/settings/inbound-webhooks', requires: need('inbound_webhooks', 'read') },
];

function toRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => (/^\[.+\]$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${source}$`);
}

const COMPILED = ROUTE_RULES.map((rule) => ({
  rule,
  regex: toRegExp(rule.pattern),
  dynamicSegments: (rule.pattern.match(/\[/g) ?? []).length,
}));

/** The requirement of the page at `pathname`, or null when no entry matches (the guard denies it). */
export function requirementForPath(pathname: string): Requirement | null {
  const clean = (pathname.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  const matches = COMPILED.filter(({ regex }) => regex.test(clean));
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.dynamicSegments - b.dynamicSegments);
  return matches[0]!.rule.requires;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/lib/route-access.test.ts`
Expected: PASS. If "has an entry for every dashboard page" fails, the failure message lists the pattern that differs: add or remove that entry.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/shared/lib/route-access.ts apps/web/tests/shared/lib/route-access.test.ts
git add apps/web
git commit -m "feat(web): add the route access table"
```

---

### Task 6: The page guard and the no-access states

**Files:**
- Create: `apps/web/src/shared/components/layout/visible-nav.ts`
- Create: `apps/web/src/shared/components/layout/no-access.tsx`
- Create: `apps/web/src/shared/components/layout/require-access.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`
- Test: `apps/web/tests/shared/components/layout/visible-nav.test.ts`, `apps/web/tests/shared/components/layout/require-access.test.tsx`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, and `NAV_GROUPS`, `NavGroup`, `NavLink`, `NavContext`, `NavSubItem` from `nav-items.ts`.
- Produces: `visibleNavGroups(subject): VisibleGroup[]` where `VisibleGroup = { group: NavGroup; items: NavLink[]; context: NavContext | undefined }` (context has its `subItems` filtered, and is undefined when its list page is not allowed), `firstAllowedHref(subject): string`, `NoAccessYet`, `AccessDenied` (props `requirement: Requirement | null`, `href: string`), `RequireAccess`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/shared/components/layout/visible-nav.test.ts`:

```ts
import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import type { AccessSubject, Permissions } from '@/shared/lib/access';
import { firstAllowedHref, visibleNavGroups } from '@/shared/components/layout/visible-nav';

const none = Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'none'])) as Permissions;
const member = (permissions: Partial<Permissions>): AccessSubject => ({
  root: false,
  permissions: { ...none, ...permissions },
});
const root: AccessSubject = { root: true, permissions: none };

const names = (subject: AccessSubject | null) =>
  visibleNavGroups(subject).map((entry) => [
    entry.group.label,
    entry.items.map((item) => item.name),
    entry.context?.subItems.map((item) => item.name),
  ]);

describe('visibleNavGroups', () => {
  it('shows everything to root', () => {
    expect(names(root)).toEqual([
      ['Overview', ['Dashboard', 'Members', 'Stats'], undefined],
      ['Discord', [], ['Overview', 'Members', 'Roles', 'Channels', 'Sync']],
      ['Projects', ['All projects'], ['Keys & settings', 'Server access', 'Webhooks', 'Inbound webhooks']],
      ['System', ['Monitoring', 'Settings'], undefined],
    ]);
  });

  it('shows only Settings to a member with no access', () => {
    expect(names(member({}))).toEqual([['System', ['Settings'], undefined]]);
  });

  it('hides a context group whose list is not allowed, even when a sub-page is', () => {
    const entries = names(member({ channels: 'read' }));
    expect(entries.map(([label]) => label)).not.toContain('Discord');
  });

  it('filters the sub-items of a context by their own requirement', () => {
    const entries = visibleNavGroups(member({ servers: 'read', members: 'read', sync: 'read' }));
    const discord = entries.find((entry) => entry.group.label === 'Discord');
    expect(discord?.context?.subItems.map((item) => item.name)).toEqual(['Overview', 'Members', 'Sync']);
  });

  it('needs both servers and statistics to offer the Roles sub-page', () => {
    const withoutStats = visibleNavGroups(member({ servers: 'read', roles: 'read' }));
    const discord = withoutStats.find((entry) => entry.group.label === 'Discord');
    expect(discord?.context?.subItems.map((item) => item.name)).toEqual(['Overview']);
  });

  it('shows the Monitoring link when either monitoring or audit is readable', () => {
    expect(names(member({ audit: 'read' })).flat(2)).toContain('Monitoring');
  });
});

describe('firstAllowedHref', () => {
  it('points at the first page the member can open, or at Settings', () => {
    expect(firstAllowedHref(root)).toBe('/dashboard');
    expect(firstAllowedHref(member({ stats: 'read' }))).toBe('/dashboard');
    expect(firstAllowedHref(member({}))).toBe('/dashboard/settings');
    expect(firstAllowedHref(null)).toBe('/dashboard/settings');
  });
});
```

Create `apps/web/tests/shared/components/layout/require-access.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signInAs } from '../../../helpers/auth';

const nav = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { RequireAccess } from '@/shared/components/layout/require-access';

function renderGuard() {
  return render(
    <RequireAccess>
      <p>the page</p>
    </RequireAccess>
  );
}

beforeEach(() => {
  nav.pathname = '/dashboard/members';
});

describe('RequireAccess', () => {
  it('renders the page when the member meets the route requirement', () => {
    signInAs({ permissions: { members: 'read' } });
    renderGuard();
    expect(screen.getByText('the page')).toBeInTheDocument();
  });

  it('names what the page needs and links to a page the member can use', () => {
    signInAs({ permissions: { stats: 'read' } });
    renderGuard();

    expect(screen.queryByText('the page')).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have access to this page/i)).toBeInTheDocument();
    expect(screen.getByText(/Members: read/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to the dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('denies a route that is not in the table', () => {
    signInAs({ root: true });
    nav.pathname = '/dashboard/not-a-page';
    renderGuard();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have access to this page/i)).toBeInTheDocument();
  });

  it('shows "No access yet" at the dashboard to a member with no access, and offers Settings', () => {
    signInAs({ permissions: {} });
    nav.pathname = '/dashboard';
    renderGuard();

    expect(screen.getByText('No access yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/dashboard/settings');
  });

  it('lets any signed-in member open Settings', () => {
    signInAs({ permissions: {} });
    nav.pathname = '/dashboard/settings';
    renderGuard();
    expect(screen.getByText('the page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/components/layout/visible-nav.test.ts tests/shared/components/layout/require-access.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the visible navigation**

Create `apps/web/src/shared/components/layout/visible-nav.ts`:

```ts
import {
  NAV_GROUPS,
  type NavContext,
  type NavGroup,
  type NavLink,
} from '@/shared/components/layout/nav-items';
import { canAccess, type AccessSubject } from '@/shared/lib/access';
import { requirementForPath } from '@/shared/lib/route-access';

export interface VisibleGroup {
  group: NavGroup;
  items: NavLink[];
  /** The group's context with only the sub-items the member can open; undefined when its list is not allowed. */
  context: NavContext | undefined;
}

function allowed(subject: AccessSubject | null, path: string): boolean {
  const requirement = requirementForPath(path);
  return requirement !== null && canAccess(subject, requirement);
}

/** The sidebar as the member sees it: a link shows when its page is allowed, a group when anything in it shows. */
export function visibleNavGroups(subject: AccessSubject | null): VisibleGroup[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter((item) => allowed(subject, item.route));

    let context: NavContext | undefined;
    if (group.context && allowed(subject, group.context.list.route)) {
      const base = group.context.base;
      // Any id matches the `[id]` of the route table, so a placeholder stands in for the selected one.
      const subItems = group.context.subItems.filter((item) =>
        allowed(subject, item.segment ? `${base}/_/${item.segment}` : `${base}/_`)
      );
      if (subItems.length > 0) context = { ...group.context, subItems };
    }

    return items.length > 0 || context ? [{ group, items, context }] : [];
  });
}

/** Where to send a member who cannot open the page they asked for. */
export function firstAllowedHref(subject: AccessSubject | null): string {
  for (const { items, context } of visibleNavGroups(subject)) {
    const first = items[0]?.route ?? context?.list.route;
    if (first) return first;
  }
  return '/dashboard/settings';
}
```

- [ ] **Step 4: Implement the no-access pages and the guard**

Create `apps/web/src/shared/components/layout/no-access.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

import { useAuthStore } from '@/features/auth/stores/auth';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import type { Requirement } from '@/shared/lib/access';
import { describeRequirement } from '@/shared/lib/access-labels';

/** The dashboard for a member who holds no access at all. */
export function NoAccessYet() {
  const name = useAuthStore((state) => state.user?.name);

  return (
    <EmptyState
      icon={ShieldOff}
      title="No access yet"
      description={`${name ? `You are signed in as ${name}, but you` : 'You'} have not been given access to any part of MCDI. Ask an admin to grant your role access to what you need.`}
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link href="/dashboard/settings">Open Settings</Link>
        </Button>
      }
    />
  );
}

interface AccessDeniedProps {
  /** What the page needs, or null for a page that is not in the route table. */
  requirement: Requirement | null;
  /** The first page the member can open. */
  href: string;
}

/** A page the member may not open: says what it needs and where they can go instead. */
export function AccessDenied({ requirement, href }: AccessDeniedProps) {
  return (
    <EmptyState
      icon={ShieldOff}
      title="You don’t have access to this page"
      description={
        requirement
          ? `It needs ${describeRequirement(requirement)}. Ask an admin if you should have it.`
          : 'This page is not available.'
      }
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link href={href}>{href === '/dashboard' ? 'Go to the dashboard' : 'Go to a page you can use'}</Link>
        </Button>
      }
    />
  );
}
```

Create `apps/web/src/shared/components/layout/require-access.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { AccessDenied, NoAccessYet } from '@/shared/components/layout/no-access';
import { firstAllowedHref } from '@/shared/components/layout/visible-nav';
import { canAccess, hasAnyAccess } from '@/shared/lib/access';
import { requirementForPath } from '@/shared/lib/route-access';
import { useAccessSubject } from '@/shared/lib/use-access';

/**
 * Page guard for the dashboard. It adapts the panel to the member's access; the API still refuses
 * what the member may not do. A route that is not in the route table is denied.
 */
export function RequireAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const subject = useAccessSubject();
  const requirement = requirementForPath(pathname);

  if (requirement && canAccess(subject, requirement)) return <>{children}</>;
  if (pathname === '/dashboard' && !hasAnyAccess(subject)) return <NoAccessYet />;
  return <AccessDenied requirement={requirement} href={firstAllowedHref(subject)} />;
}
```

Replace the body of `apps/web/src/app/dashboard/layout.tsx` with:

```tsx
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { DashboardShell } from '@/shared/components/layout/dashboard-shell';
import { RequireAccess } from '@/shared/components/layout/require-access';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell>
        <RequireAccess>{children}</RequireAccess>
      </DashboardShell>
    </ProtectedRoute>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/components/layout`
Expected: PASS, including the existing `dashboard-shell`, `sidebar` and `nav-items` tests.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/src/shared/components/layout apps/web/src/app/dashboard/layout.tsx apps/web/tests/shared/components/layout
git add apps/web
git commit -m "feat(web): guard dashboard pages by the member's access"
```

---

### Task 7: The sidebar follows the member's access

**Files:**
- Modify: `apps/web/src/shared/components/layout/sidebar.tsx`
- Test: `apps/web/tests/shared/components/layout/sidebar.test.tsx`

**Interfaces:**
- Consumes: `visibleNavGroups` (Task 6), `useAccessSubject` (Task 4).

- [ ] **Step 1: Add the failing tests**

In `apps/web/tests/shared/components/layout/sidebar.test.tsx`, add the import `import { signInAs } from '../../../helpers/auth';` and append inside the top-level `describe('Sidebar', ...)`:

```tsx
  describe('access', () => {
    it('shows a member with no access only the Settings link', () => {
      signInAs({ permissions: {} });
      renderSidebar();

      expect(screen.queryByRole('group', { name: 'Overview' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Discord' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Projects' })).not.toBeInTheDocument();
      expect(group('System').getByRole('link', { name: 'Settings' })).toBeInTheDocument();
      expect(group('System').queryByRole('link', { name: 'Monitoring' })).not.toBeInTheDocument();
    });

    it('shows only the links the member can use', () => {
      signInAs({ permissions: { members: 'read', stats: 'read' } });
      renderSidebar();

      expect(group('Overview').getByRole('link', { name: 'Members' })).toBeInTheDocument();
      expect(group('Overview').getByRole('link', { name: 'Stats' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Projects' })).not.toBeInTheDocument();
    });

    it('does not ask for servers when the member cannot read them', () => {
      let serversRequested = false;
      server.use(
        http.get(`${API_URL}/servers`, () => {
          serversRequested = true;
          return HttpResponse.json([]);
        })
      );
      signInAs({ permissions: { members: 'read' } });
      renderSidebar();

      expect(serversRequested).toBe(false);
    });

    it('shows the server pages the member can use, once the servers load', async () => {
      signInAs({ permissions: { servers: 'read', channels: 'read' } });
      nav.pathname = '/dashboard/servers/srv_1/channels';
      renderSidebar();

      const discord = await screen.findByRole('group', { name: 'Discord' });
      await waitFor(() => expect(within(discord).getByRole('link', { name: 'Channels' })).toBeInTheDocument());
      expect(within(discord).queryByRole('link', { name: 'Sync' })).not.toBeInTheDocument();
      expect(within(discord).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/components/layout/sidebar.test.tsx`
Expected: the four new tests FAIL (the sidebar still renders every group). The "does not ask for servers" test also needs the query gating of the next PR, so mark it `it.skip` with the comment `// un-skipped by the gating PR` and leave it for that PR.

- [ ] **Step 3: Filter the groups in the sidebar**

In `apps/web/src/shared/components/layout/sidebar.tsx`:

1. Change the react import to `import { useEffect, useMemo, useRef } from 'react';`.
2. Replace `import { NAV_GROUPS, isLinkActive } from '@/shared/components/layout/nav-items';` with:

```tsx
import { isLinkActive } from '@/shared/components/layout/nav-items';
import { visibleNavGroups } from '@/shared/components/layout/visible-nav';
import { useAccessSubject } from '@/shared/lib/use-access';
```

3. In `Sidebar`, after `const user = useAuthStore((state) => state.user);` add:

```tsx
  const subject = useAccessSubject();
  const groups = useMemo(() => visibleNavGroups(subject), [subject]);
```

4. Replace `{NAV_GROUPS.map((group) => {` with `{groups.map(({ group, items, context }) => {`.
5. Replace `{group.items.map((item) => {` with `{items.map((item) => {`.
6. Replace the two context lines:

```tsx
                {group.context?.kind === 'server' && (
                  <ServerContextNav context={group.context} pathname={pathname} />
                )}
                {group.context?.kind === 'project' && (
                  <ProjectContextNav context={group.context} pathname={pathname} />
                )}
```

with

```tsx
                {context?.kind === 'server' && (
                  <ServerContextNav context={context} pathname={pathname} />
                )}
                {context?.kind === 'project' && (
                  <ProjectContextNav context={context} pathname={pathname} />
                )}
```

- [ ] **Step 4: Run the sidebar tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/shared/components/layout`
Expected: PASS (the skipped test aside).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/shared/components/layout/sidebar.tsx apps/web/tests/shared/components/layout/sidebar.test.tsx
git add apps/web
git commit -m "feat(web): show only the sidebar links the member can use"
```

---

### Task 8: A 403 refreshes the member's access

**Files:**
- Modify: `apps/web/src/shared/lib/api-client.ts`, `apps/web/src/providers/QueryProvider.tsx`
- Test: `apps/web/tests/lib/api-client.test.ts`, `apps/web/tests/providers/query-provider.test.tsx`

**Interfaces:**
- Produces: `setForbiddenHandler(handler: (() => void) | null): void` from `api-client.ts`. `QueryProvider` registers a handler that invalidates `authKeys.me()`.

The handler lives in `QueryProvider`, which owns the query client. (`SessionProvider` is not used: its existing tests mock the session hook and render it without a `QueryClientProvider`.)

- [ ] **Step 1: Write the failing tests**

In `tests/lib/api-client.test.ts`, before the `supports POST requests with a JSON body` test, add two tests: the handler is called once for a 403 and the API error is still thrown (`{ status: 403, message: "Requires 'read' access on 'members'" }`), and it is not called for a 404. Import `setForbiddenHandler` with the other client exports (`await import('@/shared/lib/api-client')`) and reset it with `setForbiddenHandler(null)` at the end of each test.

Create `tests/providers/query-provider.test.tsx`: render `<QueryProvider>` with a probe that runs `useQuery({ queryKey: authKeys.me(), queryFn: count, staleTime: Infinity })`, call `new ApiClient(API).get('/admin/members')` against an MSW handler that answers 403, and assert the probe's fetch count goes from 1 to 2. A second test fires two refusals together (`Promise.allSettled`) and asserts the count settles at exactly 2 (they share one refetch).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @mcdi/web exec vitest run tests/lib/api-client.test.ts tests/providers`
Expected: FAIL (`setForbiddenHandler` does not exist).

- [ ] **Step 3: Implement**

In `api-client.ts`, before `class ApiClient`, add:

```ts
let forbiddenHandler: (() => void) | null = null;

/**
 * Called once for every 403 the API answers. The app registers a handler that refreshes the
 * member's access, because a 403 usually means a grant changed since the page was drawn.
 */
export function setForbiddenHandler(handler: (() => void) | null): void {
  forbiddenHandler = handler;
}
```

and in `request`, right before `if (!response.ok) {`:

```ts
    if (response.status === 403) {
      forbiddenHandler?.();
    }
```

In `QueryProvider.tsx`, import `useEffect`, `authKeys` (`@/features/auth/api/keys`) and `setForbiddenHandler`, and before the return add:

```tsx
  useEffect(() => {
    setForbiddenHandler(() => {
      void queryClient.invalidateQueries({ queryKey: authKeys.me() }, { cancelRefetch: false });
    });
    return () => setForbiddenHandler(null);
  }, [queryClient]);
```

`cancelRefetch: false` makes refusals that arrive together share one in-flight request instead of cancelling and restarting it.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/lib tests/providers tests/features/auth tests/features/docs`
Expected: PASS. If a docs excerpt test fails for `api-client.ts`, update that excerpt in `web-guide.mdx` to the new lines.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/shared/lib/api-client.ts apps/web/src/providers/QueryProvider.tsx apps/web/tests/lib/api-client.test.ts apps/web/tests/providers
git add apps/web
git commit -m "feat(web): refresh the member's access when the API answers 403"
```

---

### Task 9: Land the spec and the plans, verify and open the pull request

**Files:**
- Create (already committed on this branch before Task 1): `docs/superpowers/specs/2026-10-07-admin-panel-access-design.md`, `docs/superpowers/plans/2026-10-07-admin-panel-foundations.md`, `docs/superpowers/plans/2026-10-07-admin-panel-gating.md`, `docs/superpowers/plans/2026-10-07-admin-panel-access-screen.md`

- [ ] **Step 1: Full verification**

```bash
pnpm typecheck
pnpm --filter @mcdi/web exec vitest run
pnpm --filter @mcdi/web run lint
pnpm --filter @mcdi/api exec jest --config jest.config.cjs
pnpm build
```

Expected: everything passes. Run `pnpm build` in a clean shell (see the constraints).

- [ ] **Step 2: Push and open the pull request to `dev`**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin benabdou/admin-panel-foundations
gh pr create --base dev --head benabdou/admin-panel-foundations \
  --title "feat(web): foundations for an admin panel that follows the member's access levels" \
  --body "## Summary
First of three PRs for the panel. Design: \`docs/superpowers/specs/2026-10-07-admin-panel-access-design.md\` (included here with the three plans).

The API already decides what an admin may do by a level per resource. This adds the rules and plumbing for the panel to follow it:
- \`/auth/admin/me\` data (\`root\`, \`permissions\`) is kept in the auth store, revalidated every minute and on focus.
- The resource and level catalog moves into \`@mcdi/contracts\` and is shared with the API.
- A rules library (\`canAccess\`, \`Requirement\`), \`useCan\` and \`<Can>\`.
- One route table (\`route-access.ts\`) drives the sidebar and a page guard. An unlisted route is denied, and a test fails when a dashboard page has no entry.
- A member with no access sees a 'No access yet' page; a forbidden URL shows what it needs and where to go. The sidebar shows only the links the member can use.
- Any API 403 refreshes the member's access.

Not in this PR: gating of query hooks, sections and buttons (PR 2) and the Access screen (PR 3).

## Test plan
- [x] Unit and component tests for the rules, hooks, route table (including the filesystem coverage test), page guard, sidebar and 403 refresh
- [x] Full web suite passes; the default test user is root, limited and anonymous users are set explicitly
- [x] \`pnpm typecheck\`, \`pnpm build\`, lint on the changed files, API unit tests"
```

Expected: the PR URL is printed. The commits and the PR body carry no Claude signature.
