# Admin Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-or-nothing `SystemAdminGuard` with per-resource `read`/`write`/`manage` levels granted to Discord roles, with per-person overrides, enforced on every admin endpoint.

**Architecture:** A code-level catalog of 14 resources and 4 ordered levels. Two tables hold role grants and member overrides. `AdminAccessService` resolves a member's effective level per resource (root, then override, then highest role level) and caches it in Redis inside the existing `PermissionCacheService`. A new `AdminAccessGuard` and three decorators (`@RequirePermission`, `@AdminSessionOnly`, `@RootOnly`) replace `SystemAdminGuard` and fail closed. A root-only `/admin/access` API edits grants and writes audit rows.

**Tech Stack:** NestJS 11, Drizzle ORM + Postgres, Redis, Jest (unit next to source in `apps/api/src`, e2e in `apps/api/test`), pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-10-07-admin-permissions-design.md`

## Global Constraints

- Levels are `none < read < write < manage` and cumulative. One level is stored per subject and resource; the check is an ordered comparison.
- Root is the Discord roles `MC_EXECUTIVE_ROLE_ID`, `MC_DEV_LEADS_ROLE_ID` and `MC_IT_LEADS_ROLE_ID` (config keys `discord.executiveRoleId`, `discord.devLeadRoleId`, `discord.itLeadRoleId`). Root holds `manage` on everything and is not editable in the platform.
- The catalog lives in code at `apps/api/src/common/permissions/catalog.ts`, not in the database.
- New tables are `admin_role_access` and `admin_member_access`. Do not reuse the existing `permissions` or `role_permissions` names.
- Fail closed: an admin handler with no declared requirement is rejected with 403.
- Project API-key endpoints (`ApiKeyGuard`, `operations`, `scopes`), end-user session endpoints and the `/auth/*` login flows are not changed, except the admin login gate (Task 7).
- Migrations are applied by `psql` on every boot and must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, constraints guarded by a `pg_constraint` check).
- The API Jest coverage thresholds in `apps/api/jest.config.cjs` stay enforced (lines 80, functions 75, branches 68, statements 80).
- Prose in docs uses plain hyphens, no em or en dashes, present tense, and describes what the code does.
- Commits and the PR carry no `Co-Authored-By` trailer and no Claude signature. Push with `git -c credential.helper= -c credential.helper='!gh auth git-credential' push`. The PR targets `dev`.
- All commands run from the repository root `/Users/destockphonedz/Documents/MCDI/MCDI` unless a step says otherwise. Work on the existing branch `benabdou/admin-permissions-spec`.

## Delivery in three pull requests

The work ships as three pull requests, each green and safe on its own, each branched from the latest `origin/dev` and targeting `dev`. The spec and this plan ship first as a small docs PR from `benabdou/admin-permissions-spec`.

| PR | Branch | Tasks | State of `dev` after merge |
|---|---|---|---|
| 0. Docs | `benabdou/admin-permissions-spec` | spec and plan | No code change |
| A. Foundations | `benabdou/admin-access-foundations` | 1-5 | Additive only: catalog, resolver, two tables and migration, cache entries, `AdminAccessService`. Nothing calls it yet |
| B. Enforcement | `benabdou/admin-access-enforcement` | 6-10 | The switch: `AdminAccessGuard` on every admin endpoint, login without the admin-role gate, `SystemAdminGuard` removed. Only root has access until C |
| C. Grant management | `benabdou/admin-access-grants` | 11-13, 14 | Root can grant levels through `/admin/access`. E2E tests and docs |

Status: PR A is merged (#198), PR B is open (#199), PR C is next. Merge order is A, then B, then C. Verification for each PR: lint, typecheck, the unit tests of the touched areas, and `pnpm build`. PR B and PR C also run the whole API e2e suite (Task 15 lists the commands). Do not start a PR's branch before the previous one is merged, so every branch starts from a `dev` that contains its dependencies.

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/common/permissions/catalog.ts` (create) | Resources, levels, ordering, descriptions, type guards |
| `apps/api/src/common/permissions/resolve-access.ts` (create) | Pure function: effective level per resource |
| `apps/api/src/database/entities/admin-role-access.entity.ts` (create) | `admin_role_access` table |
| `apps/api/src/database/entities/admin-member-access.entity.ts` (create) | `admin_member_access` table |
| `apps/api/src/database/migrations/0006_*.sql` (generate, then edit) | Idempotent migration |
| `apps/api/src/modules/permissions/permission-cache.service.ts` (modify) | Admin-access cache entries, invalidation |
| `apps/api/src/modules/admin-access/admin-access.repository.ts` (create) | All SQL for access |
| `apps/api/src/modules/admin-access/admin-access.service.ts` (create) | Resolution and caching, root check |
| `apps/api/src/modules/admin-access/admin-access-grants.service.ts` (create) | Grant editing: validation, root lock, audit, invalidation |
| `apps/api/src/modules/admin-access/admin-access.controller.ts` (create) | Root-only `/admin/access` API |
| `apps/api/src/modules/admin-access/dto/set-grants.dto.ts` (create) | Request body for grant edits |
| `apps/api/src/modules/admin-access/admin-access.module.ts` (create) | Global module |
| `apps/api/src/common/decorators/admin-access.decorator.ts` (create) | `@RequirePermission`, `@AdminSessionOnly`, `@RootOnly` |
| `apps/api/src/common/guards/admin-access.guard.ts` (create) | The guard replacing `SystemAdminGuard` |
| `apps/api/src/common/guards/admin-access-coverage.spec.ts` (create) | Every admin route is classified exactly as the spec says |
| 13 admin controllers (modify) | Swap the guard, add decorators |
| `apps/api/src/modules/auth/services/admin-auth.service.ts` (modify) | Drop the admin-role login gate, return permissions in `getMe` |
| `apps/api/test/admin-access.e2e-spec.ts` (create) | End-to-end behavior |
| Docs pages, spec | See Task 14 |

---

### Task 1: Catalog and levels

**Files:**
- Create: `apps/api/src/common/permissions/catalog.ts`
- Test: `apps/api/src/common/permissions/catalog.spec.ts`

**Interfaces:**
- Produces: `ACCESS_RESOURCES`, `AccessResource`, `ACCESS_LEVELS`, `AccessLevel`, `GrantLevel`, `GRANT_LEVELS`, `levelAtLeast(effective, required)`, `isAccessResource(v)`, `isAccessLevel(v)`, `isGrantLevel(v)`, `RESOURCE_DESCRIPTIONS`, `LEVEL_DESCRIPTIONS`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/permissions/catalog.spec.ts`:

```ts
import {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  GRANT_LEVELS,
  LEVEL_DESCRIPTIONS,
  RESOURCE_DESCRIPTIONS,
  isAccessLevel,
  isAccessResource,
  isGrantLevel,
  levelAtLeast,
} from './catalog';

describe('catalog', () => {
  it('lists the 14 resources from the design, in snake case', () => {
    expect([...ACCESS_RESOURCES]).toEqual([
      'servers',
      'members',
      'channels',
      'messages',
      'roles',
      'projects',
      'project_keys',
      'webhooks',
      'inbound_webhooks',
      'sync',
      'stats',
      'audit',
      'monitoring',
      'settings',
    ]);
  });

  it('orders the levels none, read, write, manage', () => {
    expect([...ACCESS_LEVELS]).toEqual(['none', 'read', 'write', 'manage']);
    expect([...GRANT_LEVELS]).toEqual(['read', 'write', 'manage']);
  });

  it('describes every resource and every level', () => {
    for (const resource of ACCESS_RESOURCES) {
      expect(RESOURCE_DESCRIPTIONS[resource].length).toBeGreaterThan(10);
    }
    for (const level of ACCESS_LEVELS) {
      expect(LEVEL_DESCRIPTIONS[level].length).toBeGreaterThan(3);
    }
  });

  describe('levelAtLeast', () => {
    it.each([
      ['manage', 'manage', true],
      ['manage', 'write', true],
      ['manage', 'read', true],
      ['write', 'read', true],
      ['write', 'write', true],
      ['write', 'manage', false],
      ['read', 'write', false],
      ['read', 'read', true],
      ['none', 'read', false],
      ['none', 'none', true],
    ] as const)('%s against required %s is %s', (effective, required, expected) => {
      expect(levelAtLeast(effective, required)).toBe(expected);
    });
  });

  describe('type guards', () => {
    it('accepts only known resources', () => {
      expect(isAccessResource('members')).toBe(true);
      expect(isAccessResource('nope')).toBe(false);
      expect(isAccessResource(42)).toBe(false);
    });

    it('accepts none only as an access level, never as a grant level', () => {
      expect(isAccessLevel('none')).toBe(true);
      expect(isGrantLevel('none')).toBe(false);
      expect(isGrantLevel('manage')).toBe(true);
      expect(isAccessLevel('admin')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/common/permissions/catalog.spec.ts`
Expected: FAIL, "Cannot find module './catalog'".

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/common/permissions/catalog.ts`:

```ts
/**
 * The catalog of admin access. Every admin endpoint declares one resource and
 * one level from here. It lives in code rather than the database because a new
 * endpoint needs code anyway.
 */
export const ACCESS_RESOURCES = [
  'servers',
  'members',
  'channels',
  'messages',
  'roles',
  'projects',
  'project_keys',
  'webhooks',
  'inbound_webhooks',
  'sync',
  'stats',
  'audit',
  'monitoring',
  'settings',
] as const;
export type AccessResource = (typeof ACCESS_RESOURCES)[number];

/** Ordered: each level includes everything below it. */
export const ACCESS_LEVELS = ['none', 'read', 'write', 'manage'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** A level a role can be granted. `none` exists only as a member override (a deny). */
export type GrantLevel = Exclude<AccessLevel, 'none'>;
export const GRANT_LEVELS: readonly GrantLevel[] = ['read', 'write', 'manage'];

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
    typeof value === 'string' &&
    (ACCESS_RESOURCES as readonly string[]).includes(value)
  );
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === 'string' &&
    (ACCESS_LEVELS as readonly string[]).includes(value)
  );
}

export function isGrantLevel(value: unknown): value is GrantLevel {
  return isAccessLevel(value) && value !== 'none';
}

export const RESOURCE_DESCRIPTIONS: Record<AccessResource, string> = {
  servers:
    'Discord servers registered in MCDI: list, register, edit, enable, disable and delete.',
  members:
    'The member directory: lists, cross-server views and exports of member data.',
  channels: 'The channel structure of a server (names and types), not the messages.',
  messages:
    'The text of messages in a channel. The most sensitive data in MCDI.',
  roles:
    'Discord roles in MCDI: their permissions, inheritance rules and the impact of changing them.',
  projects: 'Projects that integrate with MCDI and their access to servers.',
  project_keys:
    'Project API keys: view key details, regenerate, restore and revoke.',
  webhooks: 'Outgoing Discord webhooks created by projects.',
  inbound_webhooks:
    'Inbound webhooks, their schemas, reader roles, secrets and settings.',
  sync: 'Synchronization with Discord: status, logs and triggering a full sync.',
  stats: 'Statistics about members, roles and servers, and their exports.',
  audit: 'The audit log and its export.',
  monitoring: 'Service health, endpoint usage and authentication failures.',
  settings: 'Runtime settings of the API.',
};

export const LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  none: 'No access.',
  read: 'View only, including previews and exports.',
  write: 'Read, plus create, update and trigger non-destructive actions.',
  manage: 'Write, plus delete, reset and revoke.',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mcdi/api exec jest src/common/permissions/catalog.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/permissions
git commit -m "feat(api): add the admin access catalog and level ordering"
```

---

### Task 2: Effective-access resolver

**Files:**
- Create: `apps/api/src/common/permissions/resolve-access.ts`
- Test: `apps/api/src/common/permissions/resolve-access.spec.ts`

**Interfaces:**
- Consumes: `ACCESS_RESOURCES`, `AccessLevel`, `AccessResource`, `GrantLevel`, `levelAtLeast` from `catalog.ts`.
- Produces: `AccessSource`, `EffectiveEntry`, `EffectiveAccess`, `RoleGrant`, `MemberOverride`, and `resolveEffectiveAccess(input: { isRoot: boolean; roleGrants: RoleGrant[]; overrides: MemberOverride[] }): EffectiveAccess`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/permissions/resolve-access.spec.ts`:

```ts
import { ACCESS_RESOURCES } from './catalog';
import { resolveEffectiveAccess } from './resolve-access';

describe('resolveEffectiveAccess', () => {
  it('gives root manage on every resource, ignoring grants and overrides', () => {
    const access = resolveEffectiveAccess({
      isRoot: true,
      roleGrants: [],
      overrides: [{ resource: 'members', level: 'none' }],
    });

    for (const resource of ACCESS_RESOURCES) {
      expect(access[resource]).toEqual({
        level: 'manage',
        source: { type: 'root' },
      });
    }
  });

  it('gives nothing to a member with no roles and no overrides', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [],
      overrides: [],
    });

    for (const resource of ACCESS_RESOURCES) {
      expect(access[resource]).toEqual({ level: 'none', source: { type: 'none' } });
    }
  });

  it('takes the highest level across several roles and names the role that supplied it', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [
        { roleId: 'r-hr', resource: 'members', level: 'read' },
        { roleId: 'r-dev', resource: 'members', level: 'write' },
        { roleId: 'r-hr', resource: 'audit', level: 'read' },
      ],
      overrides: [],
    });

    expect(access.members).toEqual({
      level: 'write',
      source: { type: 'role', roleId: 'r-dev' },
    });
    expect(access.audit).toEqual({
      level: 'read',
      source: { type: 'role', roleId: 'r-hr' },
    });
    expect(access.messages.level).toBe('none');
  });

  it('lets an override raise a level above the roles', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [{ roleId: 'r-dev', resource: 'projects', level: 'read' }],
      overrides: [{ resource: 'projects', level: 'manage' }],
    });

    expect(access.projects).toEqual({
      level: 'manage',
      source: { type: 'override' },
    });
  });

  it('lets an override lower a level below the roles', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [{ roleId: 'r-dev', resource: 'projects', level: 'manage' }],
      overrides: [{ resource: 'projects', level: 'read' }],
    });

    expect(access.projects.level).toBe('read');
  });

  it('lets an override of none deny what a role grants, for that resource only', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [
        { roleId: 'r-dev', resource: 'messages', level: 'read' },
        { roleId: 'r-dev', resource: 'channels', level: 'read' },
      ],
      overrides: [{ resource: 'messages', level: 'none' }],
    });

    expect(access.messages).toEqual({ level: 'none', source: { type: 'override' } });
    expect(access.channels.level).toBe('read');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/common/permissions/resolve-access.spec.ts`
Expected: FAIL, "Cannot find module './resolve-access'".

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/common/permissions/resolve-access.ts`:

```ts
import {
  ACCESS_RESOURCES,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from './catalog';

export type AccessSource =
  | { type: 'root' }
  | { type: 'override' }
  | { type: 'role'; roleId: string }
  | { type: 'none' };

export interface EffectiveEntry {
  level: AccessLevel;
  source: AccessSource;
}

export type EffectiveAccess = Record<AccessResource, EffectiveEntry>;

export interface RoleGrant {
  roleId: string;
  resource: AccessResource;
  level: GrantLevel;
}

export interface MemberOverride {
  resource: AccessResource;
  level: AccessLevel;
}

/**
 * Per resource: root wins, then a member override is final (it may raise,
 * lower or deny), then the highest level across the member's role grants.
 */
export function resolveEffectiveAccess(input: {
  isRoot: boolean;
  roleGrants: RoleGrant[];
  overrides: MemberOverride[];
}): EffectiveAccess {
  const overrides = new Map<AccessResource, AccessLevel>(
    input.overrides.map((o) => [o.resource, o.level]),
  );
  const result = {} as EffectiveAccess;

  for (const resource of ACCESS_RESOURCES) {
    if (input.isRoot) {
      result[resource] = { level: 'manage', source: { type: 'root' } };
      continue;
    }

    const override = overrides.get(resource);
    if (override !== undefined) {
      result[resource] = { level: override, source: { type: 'override' } };
      continue;
    }

    let best: EffectiveEntry = { level: 'none', source: { type: 'none' } };
    for (const grant of input.roleGrants) {
      if (grant.resource === resource && !levelAtLeast(best.level, grant.level)) {
        best = {
          level: grant.level,
          source: { type: 'role', roleId: grant.roleId },
        };
      }
    }
    result[resource] = best;
  }

  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mcdi/api exec jest src/common/permissions`
Expected: PASS (both specs).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/permissions
git commit -m "feat(api): add the effective admin access resolver"
```

---

### Task 3: Tables, audit action type and migration

**Files:**
- Create: `apps/api/src/database/entities/admin-role-access.entity.ts`
- Create: `apps/api/src/database/entities/admin-member-access.entity.ts`
- Modify: `apps/api/src/database/entities/index.ts` (add two exports after `app-settings.entity`)
- Modify: `apps/api/src/database/entities/audit-log.entity.ts` (add `'access'` to `auditActionTypeEnum`)
- Generate then edit: `apps/api/src/database/migrations/0006_*.sql`

**Interfaces:**
- Produces: `adminRoleAccess` and `adminMemberAccess` Drizzle tables (columns `roleId|memberId`, `resource`, `level`, `updatedAt`, `updatedBy`), and the audit action type `'access'`.

- [ ] **Step 1: Create the role-access entity**

Create `apps/api/src/database/entities/admin-role-access.entity.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import type { GrantLevel } from '../../common/permissions/catalog';
import { roles } from './role.entity';

/**
 * The level a Discord role of the main server holds on an admin resource.
 * Exactly one row per (role, resource). `none` is never stored here: removing
 * a grant deletes the row. Resource keys are validated against the catalog in
 * code (`common/permissions/catalog.ts`).
 */
export const adminRoleAccess = pgTable(
  'admin_role_access',
  {
    roleId: varchar('role_id', { length: 255 })
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    resource: varchar('resource', { length: 32 }).notNull(),
    level: varchar('level', { length: 16 }).$type<GrantLevel>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Member id of the root admin; loose (no FK) like app_settings.updated_by.
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.resource] }),
    check(
      'admin_role_access_level_check',
      sql`${t.level} in ('read', 'write', 'manage')`,
    ),
  ],
);

export type AdminRoleAccessRow = typeof adminRoleAccess.$inferSelect;
```

- [ ] **Step 2: Create the member-access entity**

Create `apps/api/src/database/entities/admin-member-access.entity.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AccessLevel } from '../../common/permissions/catalog';
import { members } from './member.entity';

/**
 * A per-person override. When a row exists for (member, resource) its level
 * replaces whatever the member's roles grant, so it can raise, lower or deny
 * (`none`) access for that member only.
 */
export const adminMemberAccess = pgTable(
  'admin_member_access',
  {
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id, { onDelete: 'cascade' })
      .notNull(),
    resource: varchar('resource', { length: 32 }).notNull(),
    level: varchar('level', { length: 16 }).$type<AccessLevel>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.resource] }),
    check(
      'admin_member_access_level_check',
      sql`${t.level} in ('none', 'read', 'write', 'manage')`,
    ),
  ],
);

export type AdminMemberAccessRow = typeof adminMemberAccess.$inferSelect;
```

- [ ] **Step 3: Export both and add the audit action type**

In `apps/api/src/database/entities/index.ts`, after the line `export * from './app-settings.entity';` add:

```ts
export * from './admin-role-access.entity';
export * from './admin-member-access.entity';
```

In `apps/api/src/database/entities/audit-log.entity.ts`, change the enum to:

```ts
export const auditActionTypeEnum = pgEnum('audit_action_type', [
  'auth',
  'project',
  'server',
  'role',
  'webhook',
  'member',
  'sync',
  'permission',
  'access',
]);
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm --filter @mcdi/api run db:generate`
Expected: a new `apps/api/src/database/migrations/0006_<name>.sql`, a new snapshot and an updated `meta/_journal.json`. If drizzle-kit asks whether a table was renamed, answer that both are new tables.

- [ ] **Step 5: Make the migration idempotent**

Open the generated `0006_*.sql` and replace its whole content with the following (keep the file name drizzle-kit chose):

```sql
ALTER TYPE "public"."audit_action_type" ADD VALUE IF NOT EXISTS 'access';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_role_access" (
	"role_id" varchar(255) NOT NULL,
	"resource" varchar(32) NOT NULL,
	"level" varchar(16) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	CONSTRAINT "admin_role_access_role_id_resource_pk" PRIMARY KEY("role_id","resource"),
	CONSTRAINT "admin_role_access_level_check" CHECK ("admin_role_access"."level" in ('read', 'write', 'manage'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_member_access" (
	"member_id" varchar(255) NOT NULL,
	"resource" varchar(32) NOT NULL,
	"level" varchar(16) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255),
	CONSTRAINT "admin_member_access_member_id_resource_pk" PRIMARY KEY("member_id","resource"),
	CONSTRAINT "admin_member_access_level_check" CHECK ("admin_member_access"."level" in ('none', 'read', 'write', 'manage'))
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_role_access_role_id_roles_id_fk' AND conrelid = 'public.admin_role_access'::regclass) THEN
    ALTER TABLE "admin_role_access" ADD CONSTRAINT "admin_role_access_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_member_access_member_id_members_id_fk' AND conrelid = 'public.admin_member_access'::regclass) THEN
    ALTER TABLE "admin_member_access" ADD CONSTRAINT "admin_member_access_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
```

- [ ] **Step 6: Apply it twice and inspect**

Run (needs the local Postgres from `docker compose up -d` in `apps/api`, with `DATABASE_URL` set as in `.env`):

```bash
pnpm --filter @mcdi/api run db:migrate
pnpm --filter @mcdi/api run db:migrate
psql "$DATABASE_URL" -c '\d admin_role_access' -c '\d admin_member_access' -c "select unnest(enum_range(null::audit_action_type))"
```

Expected: both runs succeed, both tables show their primary key, the check constraint and the foreign key, and the enum list ends with `access`.

- [ ] **Step 7: Prove idempotence the way production does**

`db:migrate` uses a journal, so its second run skips the file and proves nothing about the SQL. Production applies the raw SQL with `psql` on every boot, so run that directly twice:

```bash
for i in 1 2; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f apps/api/src/database/migrations/0006_*.sql; done
```

Expected: both runs finish with only `NOTICE ... already exists, skipping` lines and no errors.

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm --filter @mcdi/api run typecheck`
Expected: no errors.

```bash
git add apps/api/src/database
git commit -m "feat(api): add admin access tables and the access audit type"
```

---

### Task 4: Admin-access entries in the permission cache

This is also the sync-side wiring of issue #194: the sync handlers already call `invalidateMember` and `invalidateServer`, and admin entries are stored so those calls clear them.

**Files:**
- Modify: `apps/api/src/modules/permissions/permission-cache.service.ts`
- Test: `apps/api/src/modules/permissions/permission-cache.service.spec.ts`

**Interfaces:**
- Consumes: `EffectiveAccess` from `common/permissions/resolve-access`.
- Produces on `PermissionCacheService`: `getAdminAccess(memberId): Promise<CachedAdminAccess | null>`, `setAdminAccess(memberId, mainServerId, value): Promise<void>`, `invalidateAllAdminAccess(): Promise<void>`, and the exported type `CachedAdminAccess = { root: boolean; access: EffectiveAccess }`.

- [ ] **Step 1: Write the failing tests**

In `permission-cache.service.spec.ts`, add inside the top-level `describe('PermissionCacheService', ...)`, after the last existing nested `describe`:

```ts
  describe('admin access entries', () => {
    const adminValue = {
      root: false,
      access: {} as never,
    };

    it('returns null when nothing is cached for the member', async () => {
      mockRedisService.getJson.mockResolvedValue(null);
      const svc = await buildService();

      await expect(svc.getAdminAccess('m1')).resolves.toBeNull();
      expect(mockRedisService.getJson).toHaveBeenCalledWith(
        'mcdi:perm-cache:admin-entry:m1',
      );
    });

    it('stores the entry with the cache TTL and indexes it by member and by server', async () => {
      const svc = await buildService();

      await svc.setAdminAccess('m1', 'main-server', adminValue);

      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        'mcdi:perm-cache:admin-entry:m1',
        adminValue,
        DEFAULT_TTL_MS,
      );
      expect(mockRedisService.sAdd).toHaveBeenCalledWith(
        'mcdi:perm-cache:idx:member:m1',
        'mcdi:perm-cache:admin-entry:m1',
      );
      expect(mockRedisService.sAdd).toHaveBeenCalledWith(
        'mcdi:perm-cache:idx:server:main-server',
        'mcdi:perm-cache:admin-entry:m1',
      );
    });

    it('is cleared by invalidateMember, which the sync handlers already call', async () => {
      mockRedisService.sMembers.mockResolvedValue([
        'mcdi:perm-cache:admin-entry:m1',
      ]);
      const svc = await buildService();

      await svc.invalidateMember('m1');

      expect(mockRedisService.delete).toHaveBeenCalledWith(
        'mcdi:perm-cache:idx:member:m1',
        'mcdi:perm-cache:admin-entry:m1',
      );
    });

    it('is cleared by invalidateServer for the main server', async () => {
      mockRedisService.sMembers.mockResolvedValue([
        'mcdi:perm-cache:admin-entry:m1',
        'mcdi:perm-cache:admin-entry:m2',
      ]);
      const svc = await buildService();

      await svc.invalidateServer('main-server');

      expect(mockRedisService.delete).toHaveBeenCalledWith(
        'mcdi:perm-cache:idx:server:main-server',
        'mcdi:perm-cache:admin-entry:m1',
        'mcdi:perm-cache:admin-entry:m2',
      );
    });

    it('invalidateAllAdminAccess deletes every admin entry and nothing else', async () => {
      mockRedisService.scanKeys.mockResolvedValue([
        'mcdi:perm-cache:admin-entry:m1',
        'mcdi:perm-cache:admin-entry:m2',
      ]);
      const svc = await buildService();

      await svc.invalidateAllAdminAccess();

      expect(mockRedisService.scanKeys).toHaveBeenCalledWith(
        'mcdi:perm-cache:admin-entry:*',
      );
      expect(mockRedisService.delete).toHaveBeenCalledWith(
        'mcdi:perm-cache:admin-entry:m1',
        'mcdi:perm-cache:admin-entry:m2',
      );
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @mcdi/api exec jest src/modules/permissions/permission-cache.service.spec.ts -t "admin access entries"`
Expected: FAIL, `svc.getAdminAccess is not a function` (the two `invalidate*` tests may already pass; that is fine, they pin existing behavior for the new keys).

- [ ] **Step 3: Implement**

In `permission-cache.service.ts`:

1. Add the import after the existing imports:

```ts
import type { EffectiveAccess } from '../../common/permissions/resolve-access';
```

2. Add the exported type after the `CachedPermissions` interface:

```ts
/** Cached effective admin access for a member (see AdminAccessService). */
export interface CachedAdminAccess {
  root: boolean;
  access: EffectiveAccess;
}
```

3. Add the key helper after `serverIndexKey`:

```ts
  private adminEntryKey(memberId: string): string {
    return `${this.namespace()}:admin-entry:${memberId}`;
  }
```

4. Replace the whole `set` method with a version that shares its write logic, and add the three new methods after it:

```ts
  async set(
    memberId: string,
    serverId: string,
    value: CachedPermissions,
  ): Promise<void> {
    await this.writeEntry(this.entryKey(memberId, serverId), memberId, serverId, value);
  }

  async getAdminAccess(memberId: string): Promise<CachedAdminAccess | null> {
    return this.redisService.getJson<CachedAdminAccess>(
      this.adminEntryKey(memberId),
    );
  }

  /**
   * Admin entries are indexed under the main server as well as the member, so
   * `invalidateMember` and `invalidateServer`, which the sync handlers already
   * call, drop them too.
   */
  async setAdminAccess(
    memberId: string,
    mainServerId: string,
    value: CachedAdminAccess,
  ): Promise<void> {
    await this.writeEntry(
      this.adminEntryKey(memberId),
      memberId,
      mainServerId,
      value,
    );
  }

  /** Drop every admin entry. Used when a role grant changes: any member may hold the role. */
  async invalidateAllAdminAccess(): Promise<void> {
    const keys = await this.redisService.scanKeys(
      `${this.namespace()}:admin-entry:*`,
    );
    await this.redisService.delete(...keys);
  }

  private async writeEntry(
    entryKey: string,
    memberId: string,
    serverId: string,
    value: unknown,
  ): Promise<void> {
    await Promise.all([
      this.redisService.setJson(entryKey, value, this.ttlMs),
      this.redisService.sAdd(this.memberIndexKey(memberId), entryKey),
      this.redisService.sAdd(this.serverIndexKey(serverId), entryKey),
      this.redisService.expire(
        this.memberIndexKey(memberId),
        this.indexTtlSeconds(),
      ),
      this.redisService.expire(
        this.serverIndexKey(serverId),
        this.indexTtlSeconds(),
      ),
    ]);
  }
```

- [ ] **Step 4: Run the whole cache spec**

Run: `pnpm --filter @mcdi/api exec jest src/modules/permissions/permission-cache.service.spec.ts`
Expected: PASS, including every pre-existing test (the `set` refactor must not change behavior).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/permissions
git commit -m "feat(api): cache effective admin access beside the permission cache"
```

---

### Task 5: Access repository, service and global module

**Files:**
- Create: `apps/api/src/modules/admin-access/admin-access.repository.ts`
- Create: `apps/api/src/modules/admin-access/admin-access.service.ts`
- Create: `apps/api/src/modules/admin-access/admin-access.module.ts`
- Modify: `apps/api/src/app.module.ts` (import the module)
- Test: `apps/api/src/modules/admin-access/admin-access.service.spec.ts`

**Interfaces:**
- Consumes: `resolveEffectiveAccess`, `RoleGrant`, `MemberOverride` (Task 2); `PermissionCacheService.getAdminAccess|setAdminAccess` and `CachedAdminAccess` (Task 4); `adminRoleAccess`, `adminMemberAccess` (Task 3).
- Produces: `AdminAccessRepository` (methods below), and `AdminAccessService` with `getEffectiveAccess(memberId): Promise<CachedAdminAccess>`, `isRootRole(roleId): boolean`, `invalidateMember(memberId): Promise<void>`.

The repository is exercised by the e2e suite (Task 13); the service is unit tested here with the repository mocked, as other services in this codebase do.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/modules/admin-access/admin-access.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PermissionCacheService } from '../permissions/permission-cache.service';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

describe('AdminAccessService', () => {
  let service: AdminAccessService;
  const repo = {
    findMainServerId: jest.fn(),
    findMemberRoleIdsInServer: jest.fn(),
    findGrantsForRoles: jest.fn(),
    findMemberOverrides: jest.fn(),
  };
  const cache = {
    getAdminAccess: jest.fn(),
    setAdminAccess: jest.fn(),
    invalidateMember: jest.fn(),
  };
  const roots: Record<string, string> = {
    'discord.executiveRoleId': 'root-exec',
    'discord.devLeadRoleId': 'root-dev',
    'discord.itLeadRoleId': '',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    cache.getAdminAccess.mockResolvedValue(null);
    repo.findGrantsForRoles.mockResolvedValue([]);
    repo.findMemberOverrides.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        AdminAccessService,
        { provide: AdminAccessRepository, useValue: repo },
        { provide: PermissionCacheService, useValue: cache },
        { provide: ConfigService, useValue: { get: (k: string) => roots[k] } },
      ],
    }).compile();
    service = module.get(AdminAccessService);
  });

  it('returns the cached value without touching the database', async () => {
    const cached = { root: true, access: {} as never };
    cache.getAdminAccess.mockResolvedValue(cached);

    await expect(service.getEffectiveAccess('m1')).resolves.toBe(cached);
    expect(repo.findMainServerId).not.toHaveBeenCalled();
  });

  it('gives nobody any access, root included, when no main server exists', async () => {
    repo.findMainServerId.mockResolvedValue(null);

    const result = await service.getEffectiveAccess('m1');

    expect(result.root).toBe(false);
    expect(result.access.members.level).toBe('none');
    expect(cache.setAdminAccess).not.toHaveBeenCalled();
  });

  it('treats a holder of a root role as root with manage everywhere, and skips loading grants', async () => {
    repo.findMainServerId.mockResolvedValue('main');
    repo.findMemberRoleIdsInServer.mockResolvedValue(['other', 'root-dev']);

    const result = await service.getEffectiveAccess('m1');

    expect(result.root).toBe(true);
    expect(result.access.messages).toEqual({
      level: 'manage',
      source: { type: 'root' },
    });
    expect(repo.findGrantsForRoles).not.toHaveBeenCalled();
    expect(cache.setAdminAccess).toHaveBeenCalledWith('m1', 'main', result);
  });

  it('resolves a non-root member from role grants and overrides, then caches it', async () => {
    repo.findMainServerId.mockResolvedValue('main');
    repo.findMemberRoleIdsInServer.mockResolvedValue(['role-hr']);
    repo.findGrantsForRoles.mockResolvedValue([
      { roleId: 'role-hr', resource: 'members', level: 'read' },
      { roleId: 'role-hr', resource: 'audit', level: 'read' },
    ]);
    repo.findMemberOverrides.mockResolvedValue([
      { resource: 'audit', level: 'none' },
    ]);

    const result = await service.getEffectiveAccess('m1');

    expect(repo.findGrantsForRoles).toHaveBeenCalledWith(['role-hr']);
    expect(result.root).toBe(false);
    expect(result.access.members.level).toBe('read');
    expect(result.access.audit).toEqual({
      level: 'none',
      source: { type: 'override' },
    });
    expect(cache.setAdminAccess).toHaveBeenCalledWith('m1', 'main', result);
  });

  it('knows which roles are root, ignoring unset ones', () => {
    expect(service.isRootRole('root-exec')).toBe(true);
    expect(service.isRootRole('root-dev')).toBe(true);
    expect(service.isRootRole('')).toBe(false);
    expect(service.isRootRole('role-hr')).toBe(false);
  });

  it('invalidates one member through the cache', async () => {
    await service.invalidateMember('m1');
    expect(cache.invalidateMember).toHaveBeenCalledWith('m1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/modules/admin-access/admin-access.service.spec.ts`
Expected: FAIL, "Cannot find module './admin-access.repository'".

- [ ] **Step 3: Create the repository**

Create `apps/api/src/modules/admin-access/admin-access.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  AccessLevel,
  AccessResource,
  GrantLevel,
} from '../../common/permissions/catalog';
import type {
  MemberOverride,
  RoleGrant,
} from '../../common/permissions/resolve-access';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';

export interface ServerRoleRow {
  id: string;
  name: string;
  // roles.position is nullable
  position: number | null;
}

@Injectable()
export class AdminAccessRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findMainServerId(): Promise<string | null> {
    const [row] = await this.db
      .select({ id: schema.servers.id })
      .from(schema.servers)
      .where(eq(schema.servers.isMain, true))
      .limit(1);
    return row?.id ?? null;
  }

  /** The member's role ids that belong to the given server. */
  async findMemberRoleIdsInServer(
    memberId: string,
    serverId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ roleId: schema.roles.id })
      .from(schema.serverMemberRoles)
      .innerJoin(
        schema.roles,
        and(
          eq(schema.serverMemberRoles.roleId, schema.roles.id),
          eq(schema.roles.serverId, serverId),
        ),
      )
      .where(eq(schema.serverMemberRoles.memberId, memberId));
    return rows.map((r) => r.roleId);
  }

  async findGrantsForRoles(roleIds: string[]): Promise<RoleGrant[]> {
    if (roleIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(schema.adminRoleAccess)
      .where(inArray(schema.adminRoleAccess.roleId, roleIds));
    return rows.map((r) => ({
      roleId: r.roleId,
      resource: r.resource as AccessResource,
      level: r.level,
    }));
  }

  async findMemberOverrides(memberId: string): Promise<MemberOverride[]> {
    const rows = await this.db
      .select()
      .from(schema.adminMemberAccess)
      .where(eq(schema.adminMemberAccess.memberId, memberId));
    return rows.map((r) => ({
      resource: r.resource as AccessResource,
      level: r.level,
    }));
  }

  async listServerRoles(serverId: string): Promise<ServerRoleRow[]> {
    return this.db
      .select({
        id: schema.roles.id,
        name: schema.roles.name,
        position: schema.roles.position,
      })
      .from(schema.roles)
      .where(eq(schema.roles.serverId, serverId));
  }

  async findRole(
    roleId: string,
  ): Promise<{ id: string; serverId: string; name: string } | null> {
    const [row] = await this.db
      .select({
        id: schema.roles.id,
        serverId: schema.roles.serverId,
        name: schema.roles.name,
      })
      .from(schema.roles)
      .where(eq(schema.roles.id, roleId))
      .limit(1);
    return row ?? null;
  }

  async memberExists(memberId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(eq(schema.members.id, memberId))
      .limit(1);
    return Boolean(row);
  }

  /** Replaces all grants of a role in one transaction. */
  async replaceRoleGrants(
    roleId: string,
    grants: Array<{ resource: AccessResource; level: GrantLevel }>,
    updatedBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.adminRoleAccess)
        .where(eq(schema.adminRoleAccess.roleId, roleId));
      if (grants.length > 0) {
        await tx.insert(schema.adminRoleAccess).values(
          grants.map((g) => ({
            roleId,
            resource: g.resource,
            level: g.level,
            updatedBy,
          })),
        );
      }
    });
  }

  /** Replaces all overrides of a member in one transaction. */
  async replaceMemberOverrides(
    memberId: string,
    overrides: Array<{ resource: AccessResource; level: AccessLevel }>,
    updatedBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.adminMemberAccess)
        .where(eq(schema.adminMemberAccess.memberId, memberId));
      if (overrides.length > 0) {
        await tx.insert(schema.adminMemberAccess).values(
          overrides.map((o) => ({
            memberId,
            resource: o.resource,
            level: o.level,
            updatedBy,
          })),
        );
      }
    });
  }

  /** Returns false when the member had no override for that resource. */
  async deleteMemberOverride(
    memberId: string,
    resource: AccessResource,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(schema.adminMemberAccess)
      .where(
        and(
          eq(schema.adminMemberAccess.memberId, memberId),
          eq(schema.adminMemberAccess.resource, resource),
        ),
      )
      .returning({ resource: schema.adminMemberAccess.resource });
    return rows.length > 0;
  }
}
```

- [ ] **Step 4: Create the service**

Create `apps/api/src/modules/admin-access/admin-access.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
} from '../../common/permissions/resolve-access';
import {
  PermissionCacheService,
  type CachedAdminAccess,
} from '../permissions/permission-cache.service';
import { AdminAccessRepository } from './admin-access.repository';

/**
 * Answers "what may this member do in the admin API". Root comes from the env
 * roles; everything else from `admin_role_access` and `admin_member_access`.
 * Results are cached per member and cleared by the sync handlers, grant edits
 * and admin login.
 */
@Injectable()
export class AdminAccessService {
  private readonly logger = new Logger(AdminAccessService.name);
  private readonly rootRoleIds: string[];

  constructor(
    private readonly repository: AdminAccessRepository,
    private readonly cache: PermissionCacheService,
    configService: ConfigService,
  ) {
    this.rootRoleIds = [
      configService.get<string>('discord.executiveRoleId'),
      configService.get<string>('discord.devLeadRoleId'),
      configService.get<string>('discord.itLeadRoleId'),
    ].filter((id): id is string => Boolean(id));
  }

  isRootRole(roleId: string): boolean {
    return this.rootRoleIds.includes(roleId);
  }

  async getEffectiveAccess(memberId: string): Promise<CachedAdminAccess> {
    const cached = await this.cache.getAdminAccess(memberId);
    if (cached) return cached;

    const mainServerId = await this.repository.findMainServerId();
    if (!mainServerId) {
      // Fail closed. Not cached, so the answer changes as soon as a main server exists.
      this.logger.warn('No main server configured: admin access is denied');
      return { root: false, access: this.nothing() };
    }

    const roleIds = await this.repository.findMemberRoleIdsInServer(
      memberId,
      mainServerId,
    );
    const isRoot = roleIds.some((id) => this.isRootRole(id));

    const [roleGrants, overrides] = isRoot
      ? [[], []]
      : await Promise.all([
          this.repository.findGrantsForRoles(roleIds),
          this.repository.findMemberOverrides(memberId),
        ]);

    const value: CachedAdminAccess = {
      root: isRoot,
      access: resolveEffectiveAccess({ isRoot, roleGrants, overrides }),
    };
    await this.cache.setAdminAccess(memberId, mainServerId, value);
    return value;
  }

  async invalidateMember(memberId: string): Promise<void> {
    await this.cache.invalidateMember(memberId);
  }

  private nothing(): EffectiveAccess {
    return resolveEffectiveAccess({ isRoot: false, roleGrants: [], overrides: [] });
  }
}
```

- [ ] **Step 5: Create the global module and register it**

Create `apps/api/src/modules/admin-access/admin-access.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

/**
 * Global so that `AdminAccessGuard`, which many modules apply with
 * `@UseGuards`, can resolve `AdminAccessService` without each module
 * importing this one. The grant-editing controller is added in Task 12.
 */
@Global()
@Module({
  imports: [PermissionsModule],
  providers: [AdminAccessRepository, AdminAccessService],
  exports: [AdminAccessService],
})
export class AdminAccessModule {}
```

In `apps/api/src/app.module.ts`, add the import next to the other module imports:

```ts
import { AdminAccessModule } from './modules/admin-access/admin-access.module';
```

and add `AdminAccessModule,` to the `imports` array right after `PermissionsModule,`.

- [ ] **Step 6: Run the test and typecheck**

Run: `pnpm --filter @mcdi/api exec jest src/modules/admin-access && pnpm --filter @mcdi/api run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/admin-access apps/api/src/app.module.ts
git commit -m "feat(api): resolve effective admin access with caching"
```

---

### Task 6: Decorators and AdminAccessGuard

**Files:**
- Create: `apps/api/src/common/decorators/admin-access.decorator.ts`
- Create: `apps/api/src/common/guards/admin-access.guard.ts`
- Test: `apps/api/src/common/guards/admin-access.guard.spec.ts`

**Interfaces:**
- Consumes: `AdminAccessService.getEffectiveAccess` (Task 5), `levelAtLeast` (Task 1), `validateSession`/`extractSessionToken` from `common/utils/auth.util`.
- Produces: `ADMIN_ACCESS_KEY`, `AdminAccessRequirement`, `RequirePermission(resource, level)`, `AdminSessionOnly()`, `RootOnly()`, and the `AdminAccessGuard` class. The guard sets `request.memberId` exactly as `SystemAdminGuard` does.

- [ ] **Step 1: Write the failing guard test**

Create `apps/api/src/common/guards/admin-access.guard.spec.ts`:

```ts
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AdminSessionOnly,
  RequirePermission,
  RootOnly,
} from '../decorators/admin-access.decorator';
import { AdminAccessGuard } from './admin-access.guard';
import { validateSession } from '../utils/auth.util';
import { ACCESS_RESOURCES } from '../permissions/catalog';
import { resolveEffectiveAccess } from '../permissions/resolve-access';

jest.mock('../utils/auth.util', () => ({
  ...jest.requireActual('../utils/auth.util'),
  validateSession: jest.fn(),
}));

class Sample {
  @RequirePermission('members', 'write')
  needsWrite() {}

  @AdminSessionOnly()
  sessionOnly() {}

  @RootOnly()
  rootOnly() {}

  undeclared() {}
}

@RequirePermission('stats', 'read')
class ClassLevel {
  inherits() {}

  @RequirePermission('stats', 'manage')
  overrides() {}
}

function contextFor(
  cls: new () => object,
  method: string,
  headers: Record<string, string> = { authorization: 'Bearer tok' },
) {
  const request: Record<string, unknown> = { headers, cookies: {} };
  const handler = (cls.prototype as Record<string, () => void>)[method];
  const context = {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AdminAccessGuard', () => {
  const access = { getEffectiveAccess: jest.fn() };
  const guard = new AdminAccessGuard({} as never, new Reflector(), access as never);
  const validate = validateSession as jest.Mock;

  const grant = (resource: string, level: 'read' | 'write' | 'manage') =>
    resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [
        { roleId: 'r', resource: resource as never, level },
      ],
      overrides: [],
    });

  beforeEach(() => {
    jest.resetAllMocks();
    validate.mockResolvedValue('member-1');
  });

  it('fails closed on a handler with no declared requirement, before touching the session', async () => {
    const { context } = contextFor(Sample, 'undeclared');

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(validate).not.toHaveBeenCalled();
  });

  it('answers 401 when no session token is sent', async () => {
    const { context } = contextFor(Sample, 'needsWrite', {});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('validates an admin-only session and records the member on the request', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('members', 'write'),
    });
    const { context, request } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(validate).toHaveBeenCalledWith({}, 'tok', { adminOnly: true });
    expect(request.memberId).toBe('member-1');
  });

  it('allows a level above the required one (manage satisfies write)', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('members', 'manage'),
    });
    const { context } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses a level below the required one and names the resource and level', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('members', 'read'),
    });
    const { context } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).rejects.toThrow(
      "Requires 'write' access on 'members'",
    );
  });

  it('refuses a member with no grant at all on the resource', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: resolveEffectiveAccess({ isRoot: false, roleGrants: [], overrides: [] }),
    });
    const { context } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('lets any valid admin session through a session-only handler without resolving access', async () => {
    const { context } = contextFor(Sample, 'sessionOnly');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(access.getEffectiveAccess).not.toHaveBeenCalled();
  });

  it('lets only root through a root-only handler', async () => {
    const all = resolveEffectiveAccess({ isRoot: true, roleGrants: [], overrides: [] });
    access.getEffectiveAccess.mockResolvedValueOnce({ root: true, access: all });
    await expect(
      guard.canActivate(contextFor(Sample, 'rootOnly').context),
    ).resolves.toBe(true);

    const manageEverything = Object.fromEntries(
      ACCESS_RESOURCES.map((r) => [r, { level: 'manage', source: { type: 'override' } }]),
    );
    access.getEffectiveAccess.mockResolvedValueOnce({
      root: false,
      access: manageEverything,
    });
    await expect(
      guard.canActivate(contextFor(Sample, 'rootOnly').context),
    ).rejects.toThrow(ForbiddenException);
  });

  it('uses a class-level requirement when the handler declares none, and lets the handler override it', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('stats', 'read'),
    });

    await expect(
      guard.canActivate(contextFor(ClassLevel, 'inherits').context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(ClassLevel, 'overrides').context),
    ).rejects.toThrow("Requires 'manage' access on 'stats'");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/common/guards/admin-access.guard.spec.ts`
Expected: FAIL, "Cannot find module '../decorators/admin-access.decorator'".

- [ ] **Step 3: Create the decorators**

Create `apps/api/src/common/decorators/admin-access.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { AccessResource, GrantLevel } from '../permissions/catalog';

export const ADMIN_ACCESS_KEY = 'admin_access';

export type AdminAccessRequirement =
  | { kind: 'permission'; resource: AccessResource; level: GrantLevel }
  | { kind: 'session' }
  | { kind: 'root' };

/** The endpoint needs at least `level` on `resource`. Works on a handler or a whole controller. */
export const RequirePermission = (resource: AccessResource, level: GrantLevel) =>
  SetMetadata<string, AdminAccessRequirement>(ADMIN_ACCESS_KEY, {
    kind: 'permission',
    resource,
    level,
  });

/** The endpoint acts on the caller's own data: any valid admin session may call it. */
export const AdminSessionOnly = () =>
  SetMetadata<string, AdminAccessRequirement>(ADMIN_ACCESS_KEY, {
    kind: 'session',
  });

/** Only root admins may call the endpoint. It is not a catalog resource, so it cannot be granted. */
export const RootOnly = () =>
  SetMetadata<string, AdminAccessRequirement>(ADMIN_ACCESS_KEY, {
    kind: 'root',
  });
```

- [ ] **Step 4: Create the guard**

Create `apps/api/src/common/guards/admin-access.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request } from 'express';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { AdminAccessService } from '../../modules/admin-access/admin-access.service';
import {
  ADMIN_ACCESS_KEY,
  type AdminAccessRequirement,
} from '../decorators/admin-access.decorator';
import { levelAtLeast } from '../permissions/catalog';
import { extractSessionToken, validateSession } from '../utils/auth.util';

/**
 * Gate for every admin endpoint. It fails closed: a handler (or its
 * controller) must declare `@RequirePermission`, `@AdminSessionOnly` or
 * `@RootOnly`, otherwise the request is refused before the session is read.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  private readonly logger = new Logger(AdminAccessGuard.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly reflector: Reflector,
    private readonly adminAccess: AdminAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      AdminAccessRequirement | undefined
    >(ADMIN_ACCESS_KEY, [context.getHandler(), context.getClass()]);

    if (!requirement) {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} has no admin access requirement`,
      );
      throw new ForbiddenException('This endpoint has no declared permission');
    }

    const request = context.switchToHttp().getRequest<Request>();
    // Token from Authorization: Bearer <token> or the admin_session httpOnly cookie
    const token = extractSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Session token is required');
    }

    // Admin login sessions only: project-issued sessions are rejected
    const memberId = await validateSession(this.db, token, { adminOnly: true });
    (request as Request & { memberId: string }).memberId = memberId;

    if (requirement.kind === 'session') return true;

    const { root, access } = await this.adminAccess.getEffectiveAccess(memberId);

    if (requirement.kind === 'root') {
      if (!root) throw new ForbiddenException('Restricted to root admins');
      return true;
    }

    const { resource, level } = requirement;
    if (!levelAtLeast(access[resource].level, level)) {
      throw new ForbiddenException(
        `Requires '${level}' access on '${resource}'`,
      );
    }
    return true;
  }
}
```

- [ ] **Step 5: Run the test and typecheck**

Run: `pnpm --filter @mcdi/api exec jest src/common/guards/admin-access.guard.spec.ts && pnpm --filter @mcdi/api run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/decorators/admin-access.decorator.ts apps/api/src/common/guards/admin-access.guard.ts apps/api/src/common/guards/admin-access.guard.spec.ts
git commit -m "feat(api): add AdminAccessGuard and its decorators, failing closed"
```

---

### Task 7: Admin login no longer needs an admin role, and `/auth/admin/me` returns permissions

**Files:**
- Modify: `apps/api/src/modules/auth/services/admin-auth.service.ts`
- Modify: `apps/api/src/modules/auth/dto/set-password.dto.ts` (the file that defines `AdminMeResponseDto`)
- Test: `apps/api/src/modules/auth/services/admin-auth.service.spec.ts`

**Interfaces:**
- Consumes: `AdminAccessService.getEffectiveAccess` and `invalidateMember` (Task 5), `ACCESS_RESOURCES` (Task 1).
- Produces: `getMe(token)` now also returns `root: boolean` and `permissions: Record<AccessResource, AccessLevel>`.

- [ ] **Step 1: Update the tests first**

In `admin-auth.service.spec.ts`:

1. Add the import: `import { AdminAccessService } from '../../admin-access/admin-access.service';` and the catalog import `import { ACCESS_RESOURCES } from '../../../common/permissions/catalog';`.
2. Declare `let adminAccessService: { getEffectiveAccess: jest.Mock; invalidateMember: jest.Mock };` next to the other `let` mocks, create it in `beforeEach` before `Test.createTestingModule`:

```ts
    adminAccessService = {
      getEffectiveAccess: jest.fn(),
      invalidateMember: jest.fn().mockResolvedValue(undefined),
    };
```

and add `{ provide: AdminAccessService, useValue: adminAccessService },` to the `providers` array.
3. Replace the test `'returns member on success'` with:

```ts
    it('returns the member with root and the effective level per resource', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({
        memberId: '1',
        expiresAt: new Date(),
      } as any);
      memberRepository.findById.mockResolvedValue({
        id: '1',
        username: 'a',
      } as any);
      adminAccessService.getEffectiveAccess.mockResolvedValue({
        root: false,
        access: Object.fromEntries(
          ACCESS_RESOURCES.map((r) => [
            r,
            r === 'members'
              ? { level: 'read', source: { type: 'role', roleId: 'r' } }
              : { level: 'none', source: { type: 'none' } },
          ]),
        ),
      });

      const res = await service.getMe('t');

      expect(res.id).toBe('1');
      expect(res.root).toBe(false);
      expect(res.permissions.members).toBe('read');
      expect(res.permissions.messages).toBe('none');
      expect(Object.keys(res.permissions)).toEqual([...ACCESS_RESOURCES]);
    });
```

4. Delete the test `'throws Forbidden if the member lacks the Executive role'`.
5. In `'records a failed login with the reason, ...'`, replace the second half (from `discordService.fetchOAuthGuildMember.mockResolvedValue({ ok: true, roleIds: ['role-lead'] }` to the end of the test) with a not-in-the-main-guild failure:

```ts
      discordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: false,
        status: 404,
      } as any);
      await expect(
        service.handleAdminDiscordCallback('code', 'valid'),
      ).rejects.toThrow(ForbiddenException);

      expect(auditService.logAction).toHaveBeenLastCalledWith(
        expect.objectContaining({
          actorId: 'discord123',
          action: 'login_failed',
          details: {
            reason:
              'You must be a member of the main MCDI Discord server to access the admin panel',
            attemptedActor: 'discord123',
          },
        }),
      );
```

6. Add a new test inside `describe('handleAdminDiscordCallback', ...)`, after `'returns token and member if successful'`:

```ts
    it('lets a main-server member with no admin role sign in, and clears their cached access', async () => {
      discordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: true,
        roleIds: ['role-hr'],
      } as any);

      const res = await service.handleAdminDiscordCallback('code', 'valid');

      expect(res.token).toBe('issued-token');
      expect(adminAccessService.invalidateMember).toHaveBeenCalledWith(
        'discord123',
      );
    });
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/modules/auth/services/admin-auth.service.spec.ts`
Expected: FAIL (the no-admin-role test is rejected with Forbidden, `getMe` has no `root`).

- [ ] **Step 3: Edit the service**

In `admin-auth.service.ts`:

1. Add imports below the existing `AuditService` import:

```ts
import { AdminAccessService } from '../../admin-access/admin-access.service';
import { ACCESS_RESOURCES } from '../../../common/permissions/catalog';
```

2. Delete the field `private readonly adminRoleIds: string[];`, the line `this.adminRoleIds = this.buildAdminRoleIds();` in the constructor, and the whole `private buildAdminRoleIds(): string[] { ... }` method.
3. Add the constructor parameter after `private readonly auditService: AuditService,`:

```ts
    private readonly adminAccessService: AdminAccessService,
```

4. In the doc comment of `handleAdminDiscordCallback`, replace the step list lines 4 to 8 with:

```
   *  4. Verify the user is a member of the main MCDI guild
   *  5. Sync roles into the DB and clear the member's cached admin access
   *  6. Issue a 24-hour session token
   *  7. Return token + member info
```

5. Delete the block that starts `if (!this.adminRoleIds.length) {` and ends with its closing `}` (the "no admin role ids are configured" rejection), and delete the block from `// 5. Verify the user holds at least one configured admin role` through the closing `}` of `if (!hasAdminRole) { ... }`.
6. Renumber the remaining comments: `// 6. Sync roles into the DB so guard checks work correctly` becomes `// 5. Sync roles into the DB so access checks see the current roles`, and `// 7. Issue a 24-hour session token` becomes `// 6. Issue a 24-hour session token`.
7. Right after the `await this.memberRepository.syncMemberServerData(...)` call add:

```ts
    await this.adminAccessService.invalidateMember(member.id);
```

8. Replace the `return { id: member.id, ... sessionExpiresAt: session.expiresAt };` in `getMe` with:

```ts
    const { root, access } = await this.adminAccessService.getEffectiveAccess(
      member.id,
    );

    return {
      id: member.id,
      username: member.username,
      globalName: member.globalName,
      displayName: member.displayName,
      preferredName: member.preferredName,
      avatar: member.avatar,
      email: member.email,
      isSystemAdmin: member.isSystemAdmin,
      sessionExpiresAt: session.expiresAt,
      root,
      permissions: Object.fromEntries(
        ACCESS_RESOURCES.map((resource) => [resource, access[resource].level]),
      ) as Record<(typeof ACCESS_RESOURCES)[number], AccessLevel>,
    };
```

and add `type AccessLevel` to the catalog import: `import { ACCESS_RESOURCES, type AccessLevel } from '../../../common/permissions/catalog';`.

- [ ] **Step 4: Document the new fields in the DTO**

In `apps/api/src/modules/auth/dto/set-password.dto.ts`, add at the top `import { ACCESS_LEVELS } from '../../../common/permissions/catalog';` and add these two properties at the end of the `AdminMeResponseDto` class:

```ts
  @ApiProperty({
    description:
      'True when the member holds a root role. Root has manage on every resource.',
    example: false,
  })
  root: boolean;

  @ApiProperty({
    description:
      'The effective access level per admin resource. The admin panel builds its navigation from this; the API enforces it on every request.',
    type: 'object',
    additionalProperties: { type: 'string', enum: [...ACCESS_LEVELS] },
    example: { members: 'read', messages: 'none', projects: 'write' },
  })
  permissions: Record<string, string>;
```

- [ ] **Step 5: Run the spec and typecheck**

Run: `pnpm --filter @mcdi/api exec jest src/modules/auth/services/admin-auth.service.spec.ts && pnpm --filter @mcdi/api run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth
git commit -m "feat(api): admin login no longer needs an admin role and /me returns permissions"
```

---

### Task 8: Route classification test (written first, fails until Tasks 9 and 10)

Part of PR B. The seven root-only `/admin/access` routes are added to `EXPECTED` in Task 12 (PR C), when the controller exists.

**Files:**
- Test: `apps/api/src/common/guards/admin-access-coverage.spec.ts`

This test discovers every controller that uses `AdminAccessGuard`, builds `METHOD /path` for each handler and compares the declared requirement to the spec table. It also fails on any admin handler that has no requirement, so a new unclassified endpoint cannot ship.

- [ ] **Step 1: Write the test**

Create `apps/api/src/common/guards/admin-access-coverage.spec.ts`:

```ts
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_ACCESS_KEY,
  type AdminAccessRequirement,
} from '../decorators/admin-access.decorator';
import { AdminAccessGuard } from './admin-access.guard';

const SRC = join(__dirname, '..', '..');
const GUARDS_KEY = '__guards__';

/**
 * The classification from docs/superpowers/specs/2026-10-07-admin-permissions-design.md.
 * `resource:level`, `session` (own data) or `root` (grant management).
 */
const EXPECTED: Record<string, string> = {
  // servers
  'GET /servers': 'servers:read',
  'GET /servers/:serverId': 'servers:read',
  'POST /servers': 'servers:write',
  'PATCH /servers/:serverId': 'servers:write',
  'PATCH /servers/:serverId/disable': 'servers:write',
  'PATCH /servers/:serverId/enable': 'servers:write',
  'DELETE /servers/:serverId': 'servers:manage',
  // members
  'GET /admin/members': 'members:read',
  'GET /admin/members/cross-server': 'members:read',
  'GET /admin/members/export': 'members:read',
  'GET /admin/members/:discordId/servers': 'members:read',
  // channels and messages
  'GET /admin/servers/:serverId/channels': 'channels:read',
  'GET /admin/servers/:serverId/channels/:channelId': 'channels:read',
  'GET /admin/servers/:serverId/channels/:channelId/messages': 'messages:read',
  // roles
  'GET /permissions/inheritance-rules': 'roles:read',
  'POST /permissions/inheritance-rules': 'roles:write',
  'GET /permissions/admin/servers/:serverId/roles/:roleId/permissions': 'roles:read',
  'POST /permissions/admin/servers/:serverId/roles/:roleId/permissions': 'roles:write',
  'DELETE /permissions/admin/servers/:serverId/roles/:roleId/permissions/:permissionId':
    'roles:manage',
  'POST /permissions/admin/servers/:serverId/roles/:roleId/impact': 'roles:read',
  // projects
  'GET /admin/projects': 'projects:read',
  'POST /admin/projects': 'projects:write',
  'GET /admin/projects/:id': 'projects:read',
  'PATCH /admin/projects/:id': 'projects:write',
  'DELETE /admin/projects/:id': 'projects:manage',
  'PATCH /admin/projects/:id/redirect-uri': 'projects:write',
  'PUT /admin/projects/:projectId/servers/:serverId': 'projects:write',
  'DELETE /admin/projects/:projectId/servers/:serverId': 'projects:manage',
  'GET /admin/projects/:projectId/servers': 'projects:read',
  'GET /admin/projects/servers/:serverId/projects': 'projects:read',
  'GET /admin/projects/access/matrix': 'projects:read',
  'GET /admin/projects/access/audit': 'projects:read',
  // project keys
  'GET /admin/projects/:id/api-key': 'project_keys:read',
  'POST /admin/projects/:id/regenerate-api-key': 'project_keys:write',
  'POST /admin/projects/:id/restore-key': 'project_keys:write',
  'DELETE /admin/projects/:id/key': 'project_keys:manage',
  // outbound webhooks
  'GET /admin/projects/:projectId/webhooks': 'webhooks:read',
  'GET /admin/webhooks/:webhookId': 'webhooks:read',
  'DELETE /admin/webhooks/:webhookId': 'webhooks:manage',
  // inbound webhooks
  'GET /admin/inbound-webhooks': 'inbound_webhooks:read',
  'POST /admin/inbound-webhooks': 'inbound_webhooks:write',
  'GET /admin/inbound-webhooks/settings': 'inbound_webhooks:read',
  'PUT /admin/inbound-webhooks/settings': 'inbound_webhooks:write',
  'POST /admin/inbound-webhooks/schema/preview': 'inbound_webhooks:read',
  'GET /admin/inbound-webhooks/:id': 'inbound_webhooks:read',
  'GET /admin/inbound-webhooks/:id/docs': 'inbound_webhooks:read',
  'PATCH /admin/inbound-webhooks/:id': 'inbound_webhooks:write',
  'GET /admin/inbound-webhooks/:id/roles': 'inbound_webhooks:read',
  'PUT /admin/inbound-webhooks/:id/roles': 'inbound_webhooks:write',
  'POST /admin/inbound-webhooks/:id/rotate-secret': 'inbound_webhooks:write',
  'DELETE /admin/inbound-webhooks/:id': 'inbound_webhooks:manage',
  // sync
  'POST /admin/sync/full': 'sync:write',
  'GET /admin/sync/status': 'sync:read',
  'GET /admin/sync/status/all': 'sync:read',
  'GET /admin/sync/logs': 'sync:read',
  'GET /admin/sync/logs/:syncLogId/changes': 'sync:read',
  // stats
  'GET /admin/stats/members': 'stats:read',
  'GET /admin/stats/members/growth': 'stats:read',
  'GET /admin/stats/roles': 'stats:read',
  'GET /admin/stats/servers': 'stats:read',
  'GET /admin/stats/cross-server': 'stats:read',
  'GET /admin/stats/export': 'stats:read',
  // audit and monitoring
  'GET /admin/audit/logs': 'audit:read',
  'GET /admin/audit/logs/export': 'audit:read',
  'GET /admin/monitoring/health': 'monitoring:read',
  'GET /admin/monitoring/usage': 'monitoring:read',
  'GET /admin/monitoring/auth-failures': 'monitoring:read',
  // settings
  'GET /admin/settings': 'settings:read',
  'PATCH /admin/settings': 'settings:write',
  'POST /admin/settings/reset': 'settings:manage',
  // own data: any valid admin session
  'GET /admin/profile': 'session',
  'PATCH /admin/profile': 'session',
  'GET /auth/admin/me': 'session',
  'POST /auth/admin/logout': 'session',
};

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

function describeRequirement(r: AdminAccessRequirement | undefined): string {
  if (!r) return 'MISSING';
  return r.kind === 'permission' ? `${r.resource}:${r.level}` : r.kind;
}

function joinPath(classPath: unknown, handlerPath: unknown): string {
  const parts = [classPath, handlerPath]
    .map((p) => (Array.isArray(p) ? p[0] : p))
    .map((p) => String(p ?? '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

/** Every handler whose class or method applies AdminAccessGuard, with its declared requirement. */
function discoverAdminRoutes(): Record<string, string> {
  const found: Record<string, string> = {};

  for (const file of controllerFiles(SRC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported = Object.values(require(file) as Record<string, unknown>);
    for (const cls of exported) {
      if (typeof cls !== 'function') continue;
      const classPath = Reflect.getMetadata(PATH_METADATA, cls);
      if (classPath === undefined) continue; // not a controller

      const classGuards: unknown[] = Reflect.getMetadata(GUARDS_KEY, cls) ?? [];
      const classRequirement = Reflect.getMetadata(ADMIN_ACCESS_KEY, cls) as
        | AdminAccessRequirement
        | undefined;

      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        // Read the descriptor: `cls.prototype[name]` would run getters.
        const handler = Object.getOwnPropertyDescriptor(cls.prototype, name)
          ?.value;
        if (typeof handler !== 'function') continue;
        const handlerPath = Reflect.getMetadata(PATH_METADATA, handler);
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (handlerPath === undefined || method === undefined) continue;

        const guards: unknown[] = [
          ...classGuards,
          ...(Reflect.getMetadata(GUARDS_KEY, handler) ?? []),
        ];
        if (!guards.includes(AdminAccessGuard)) continue;

        const requirement =
          (Reflect.getMetadata(ADMIN_ACCESS_KEY, handler) as
            | AdminAccessRequirement
            | undefined) ?? classRequirement;

        found[`${RequestMethod[method]} ${joinPath(classPath, handlerPath)}`] =
          describeRequirement(requirement);
      }
    }
  }
  return found;
}

describe('admin route classification', () => {
  const found = discoverAdminRoutes();

  it('finds the admin routes (guards against a vacuous pass)', () => {
    expect(Object.keys(found).length).toBeGreaterThan(70);
  });

  it('leaves no admin handler without a declared requirement', () => {
    const missing = Object.entries(found)
      .filter(([, requirement]) => requirement === 'MISSING')
      .map(([route]) => route);
    expect(missing).toEqual([]);
  });

  it('classifies every admin route exactly as the design says', () => {
    expect(found).toEqual(EXPECTED);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/common/guards/admin-access-coverage.spec.ts`
Expected: FAIL. At this point no controller uses `AdminAccessGuard`, so "finds the admin routes" fails. It goes green after Tasks 9 and 10.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/guards/admin-access-coverage.spec.ts
git commit -m "test(api): pin the classification of every admin route"
```

---

### Task 9: Classify the controllers, part 1

Swap `SystemAdminGuard` for `AdminAccessGuard` and declare the requirement on: servers, members, channels and messages, roles and permissions, projects and project keys.

For every controller in this task and in Task 10, make these edits:

- Replace `import { SystemAdminGuard } from '../../common/guards/system-admin.guard';` with `import { AdminAccessGuard } from '../../common/guards/admin-access.guard';` and add `import { RequirePermission } from '../../common/decorators/admin-access.decorator';` (add `AdminSessionOnly` or `RootOnly` to that import where the task says so).
- Replace each `@UseGuards(SystemAdminGuard)` with `@UseGuards(AdminAccessGuard)`. Where the guard is listed together with others (`@UseGuards(SystemAdminGuard, ...)`), only swap the class name.
- In the matching `*.controller.spec.ts`, replace the import path `system-admin.guard` with `admin-access.guard` and every `SystemAdminGuard` with `AdminAccessGuard`.

**Files:**
- Modify: `apps/api/src/modules/servers/servers.controller.ts` and `.spec.ts`
- Modify: `apps/api/src/modules/admin-members/admin-members.controller.ts` and `.spec.ts`
- Modify: `apps/api/src/modules/admin-channels/admin-channels.controller.ts` and `.spec.ts`
- Modify: `apps/api/src/modules/permissions/permissions.controller.ts` and `.spec.ts`
- Modify: `apps/api/src/modules/projects/projects.controller.ts` and `.spec.ts`

- [ ] **Step 1: servers.controller.ts**

The class is `@UseGuards(SystemAdminGuard) @Controller('servers')`. Add the decorator to each handler, directly under its `@Get`/`@Post`/`@Patch`/`@Delete` line:

| Handler decorator | Add |
|---|---|
| `@Post()` | `@RequirePermission('servers', 'write')` |
| `@Get()` | `@RequirePermission('servers', 'read')` |
| `@Get(':serverId')` | `@RequirePermission('servers', 'read')` |
| `@Patch(':serverId')` | `@RequirePermission('servers', 'write')` |
| `@Patch(':serverId/disable')` | `@RequirePermission('servers', 'write')` |
| `@Patch(':serverId/enable')` | `@RequirePermission('servers', 'write')` |
| `@Delete(':serverId')` | `@RequirePermission('servers', 'manage')` |

- [ ] **Step 2: admin-members.controller.ts**

All four handlers are reads. Add one class-level decorator under `@UseGuards(AdminAccessGuard)`:

```ts
@Controller('admin/members')
@UseGuards(AdminAccessGuard)
@RequirePermission('members', 'read')
```

- [ ] **Step 3: admin-channels.controller.ts**

Class-level `@RequirePermission('channels', 'read')` under the guard, and on the messages handler only, add:

```ts
  @Get(':channelId/messages')
  @RequirePermission('messages', 'read')
```

(the handler decorator overrides the class one).

- [ ] **Step 4: permissions.controller.ts**

Only the admin handlers use the guard; leave the `ApiKeyGuard` handlers untouched. Under each `@UseGuards(SystemAdminGuard)` (now `AdminAccessGuard`) add:

| Handler | Add |
|---|---|
| `@Post('inheritance-rules')` | `@RequirePermission('roles', 'write')` |
| `@Get('inheritance-rules')` | `@RequirePermission('roles', 'read')` |
| `@Get('admin/servers/:serverId/roles/:roleId/permissions')` | `@RequirePermission('roles', 'read')` |
| `@Post('admin/servers/:serverId/roles/:roleId/permissions')` | `@RequirePermission('roles', 'write')` |
| `@Delete('admin/servers/:serverId/roles/:roleId/permissions/:permissionId')` | `@RequirePermission('roles', 'manage')` |
| `@Post('admin/servers/:serverId/roles/:roleId/impact')` | `@RequirePermission('roles', 'read')` (a read-only preview) |

- [ ] **Step 5: projects.controller.ts**

The class is `@Controller('admin/projects') @UseGuards(SystemAdminGuard)`. Add per handler:

| Handler | Add |
|---|---|
| `@Post()` | `@RequirePermission('projects', 'write')` |
| `@Get()` | `@RequirePermission('projects', 'read')` |
| `@Get(':id')` | `@RequirePermission('projects', 'read')` |
| `@Patch(':id')` | `@RequirePermission('projects', 'write')` |
| `@Get(':id/api-key')` | `@RequirePermission('project_keys', 'read')` |
| `@Delete(':id/key')` | `@RequirePermission('project_keys', 'manage')` |
| `@Post(':id/restore-key')` | `@RequirePermission('project_keys', 'write')` |
| `@Delete(':id')` | `@RequirePermission('projects', 'manage')` |
| `@Post(':id/regenerate-api-key')` | `@RequirePermission('project_keys', 'write')` |
| `@Patch(':id/redirect-uri')` | `@RequirePermission('projects', 'write')` |
| `@Put(':projectId/servers/:serverId')` | `@RequirePermission('projects', 'write')` |
| `@Delete(':projectId/servers/:serverId')` | `@RequirePermission('projects', 'manage')` |
| `@Get(':projectId/servers')` | `@RequirePermission('projects', 'read')` |
| `@Get('servers/:serverId/projects')` | `@RequirePermission('projects', 'read')` |
| `@Get('access/matrix')` | `@RequirePermission('projects', 'read')` |
| `@Get('access/audit')` | `@RequirePermission('projects', 'read')` |

- [ ] **Step 6: Update the five controller specs**

Apply the spec edits described at the top of this task to `servers.controller.spec.ts`, `admin-members.controller.spec.ts`, `admin-channels.controller.spec.ts`, `permissions.controller.spec.ts` and `projects.controller.spec.ts`.

- [ ] **Step 7: Run these controllers' specs and typecheck**

Run:

```bash
pnpm --filter @mcdi/api exec jest src/modules/servers src/modules/admin-members src/modules/admin-channels src/modules/permissions src/modules/projects
pnpm --filter @mcdi/api run typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 8: See the coverage test shrink**

Run: `pnpm --filter @mcdi/api exec jest src/common/guards/admin-access-coverage.spec.ts`
Expected: still FAIL, but the diff against `EXPECTED` now lacks only the Task 10 routes (webhooks, inbound webhooks, sync, stats, audit, monitoring, settings, profile and auth). Every route from this task must match.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules
git commit -m "feat(api): declare access levels on servers, members, channels, roles and projects"
```

---

### Task 10: Classify the controllers, part 2, and remove SystemAdminGuard

**Files:**
- Modify: `admin-webhooks`, `inbound-webhooks` (admin controller only), `sync`, `stats`, `audit` (both controllers in `audit.controller.ts`), `admin-settings`, and `auth` (`admin-profile.controller.ts` and `auth.controller.ts`) under `apps/api/src/modules/*`, plus each `.spec.ts`.
- Modify: `apps/api/src/modules/auth/auth.module.ts`, `apps/api/src/modules/servers/server.guard.ts` (comment), `apps/api/src/common/utils/auth.util.ts` (comment), `apps/api/test/helpers/db.ts` (comment).
- Delete: `apps/api/src/common/guards/system-admin.guard.ts`, `system-admin.guard.spec.ts`, `apps/api/src/common/utils/admin.util.ts` (and its spec if one exists).

Apply the same import, `@UseGuards` and spec edits as described at the top of Task 9.

- [ ] **Step 1: admin-webhooks.controller.ts**

Class-level `@RequirePermission('webhooks', 'read')`; on the delete handler add:

```ts
  @Delete('webhooks/:webhookId')
  @RequirePermission('webhooks', 'manage')
```

- [ ] **Step 2: inbound-webhooks.controller.ts (the `admin/inbound-webhooks` controller)**

| Handler | Add |
|---|---|
| `@Post()` | `@RequirePermission('inbound_webhooks', 'write')` |
| `@Get()` | `@RequirePermission('inbound_webhooks', 'read')` |
| `@Get('settings')` | `@RequirePermission('inbound_webhooks', 'read')` |
| `@Put('settings')` | `@RequirePermission('inbound_webhooks', 'write')` |
| `@Post('schema/preview')` | `@RequirePermission('inbound_webhooks', 'read')` |
| `@Get(':id')` | `@RequirePermission('inbound_webhooks', 'read')` |
| `@Get(':id/docs')` | `@RequirePermission('inbound_webhooks', 'read')` |
| `@Patch(':id')` | `@RequirePermission('inbound_webhooks', 'write')` |
| `@Get(':id/roles')` | `@RequirePermission('inbound_webhooks', 'read')` |
| `@Put(':id/roles')` | `@RequirePermission('inbound_webhooks', 'write')` |
| `@Post(':id/rotate-secret')` | `@RequirePermission('inbound_webhooks', 'write')` |
| `@Delete(':id')` | `@RequirePermission('inbound_webhooks', 'manage')` |

Do not touch `inbound-webhook-ingest.controller.ts` or `inbound-webhook-read.controller.ts`.

- [ ] **Step 3: sync.controller.ts**

Class-level `@RequirePermission('sync', 'read')`; on `@Post('full')` add `@RequirePermission('sync', 'write')`.

- [ ] **Step 4: stats.controller.ts**

Class-level `@RequirePermission('stats', 'read')`.

- [ ] **Step 5: audit.controller.ts**

It holds two controllers. On `AuditController` (`admin/audit`) add class-level `@RequirePermission('audit', 'read')`. On `MonitoringController` (`admin/monitoring`) add class-level `@RequirePermission('monitoring', 'read')`.

- [ ] **Step 6: admin-settings.controller.ts**

| Handler | Add |
|---|---|
| `@Get()` | `@RequirePermission('settings', 'read')` |
| `@Patch()` | `@RequirePermission('settings', 'write')` |
| `@Post('reset')` | `@RequirePermission('settings', 'manage')` |

- [ ] **Step 7: admin-profile.controller.ts and auth.controller.ts**

In `admin-profile.controller.ts` add class-level `@AdminSessionOnly()` under the guard (import it from the decorator file). In `auth.controller.ts`, on the `@Get('admin/me')` and `@Post('admin/logout')` handlers add `@AdminSessionOnly()` under their `@UseGuards(...)` line, and import `AdminSessionOnly`. Also update the `@ApiForbiddenResponse` description on `admin/me` from "Valid session but the member lacks the configured admin role." to "Reserved. A valid admin session always succeeds here."

- [ ] **Step 8: Remove the old guard and its leftovers**

```bash
git rm apps/api/src/common/guards/system-admin.guard.ts apps/api/src/common/guards/system-admin.guard.spec.ts apps/api/src/common/utils/admin.util.ts
ls apps/api/src/common/utils/admin.util.spec.ts 2>/dev/null && git rm apps/api/src/common/utils/admin.util.spec.ts
```

In `apps/api/src/modules/auth/auth.module.ts`, delete the import `import { SystemAdminGuard } from '../../common/guards/system-admin.guard';` and the `SystemAdminGuard,` entry in `providers`. Update the three comments that mention `SystemAdminGuard` (`servers/server.guard.ts` line about route-level guards, `common/utils/auth.util.ts` doc comments, `test/helpers/db.ts` doc comment, and the header of `test/permissions.e2e-spec.ts`) to say `AdminAccessGuard`.

- [ ] **Step 9: Confirm nothing references the old guard**

Run: `grep -rn "SystemAdminGuard\|system-admin.guard\|isAdminMember" apps/api/src apps/api/test`
Expected: no output.

- [ ] **Step 10: Run the unit suite and typecheck**

Run: `pnpm --filter @mcdi/api exec jest && pnpm --filter @mcdi/api run typecheck`
Expected: everything is green, including `admin-access-coverage.spec.ts` (78 admin routes classified exactly as the design says). If a route is reported, fix its decorator.

- [ ] **Step 11: Commit**

```bash
git add -A apps/api
git commit -m "feat(api): enforce access levels on every admin endpoint and remove SystemAdminGuard"
```

---

### Task 11: Grants service

**Files:**
- Create: `apps/api/src/modules/admin-access/admin-access-grants.service.ts`
- Test: `apps/api/src/modules/admin-access/admin-access-grants.service.spec.ts`

**Interfaces:**
- Consumes: `AdminAccessRepository` and `AdminAccessService` (Task 5), `PermissionCacheService.invalidateAllAdminAccess|invalidateMember` (Task 4), `AuditService.logAction` (`actionType: 'access'`, Task 3), catalog helpers (Task 1), `ClientInfo` from `common/utils/client-info.util`.
- Produces: `AdminAccessGrantsService` with
  `getCatalog()`, `listRoles()`, `setRoleGrants(actorId, roleId, input, clientInfo?)`, `getMemberOverrides(memberId)`, `setMemberOverrides(actorId, memberId, input, clientInfo?)`, `removeMemberOverride(actorId, memberId, resource, clientInfo?)`, `getMemberEffective(memberId)`.
  `input` is `Record<string, unknown>` (the request body's `grants` object).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/admin-access/admin-access-grants.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PermissionCacheService } from '../permissions/permission-cache.service';
import { AdminAccessGrantsService } from './admin-access-grants.service';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

describe('AdminAccessGrantsService', () => {
  let service: AdminAccessGrantsService;
  const repo = {
    findMainServerId: jest.fn(),
    findRole: jest.fn(),
    listServerRoles: jest.fn(),
    findGrantsForRoles: jest.fn(),
    findMemberOverrides: jest.fn(),
    memberExists: jest.fn(),
    replaceRoleGrants: jest.fn(),
    replaceMemberOverrides: jest.fn(),
    deleteMemberOverride: jest.fn(),
  };
  const access = { isRootRole: jest.fn(), getEffectiveAccess: jest.fn() };
  const cache = {
    invalidateAllAdminAccess: jest.fn(),
    invalidateMember: jest.fn(),
  };
  const audit = { logAction: jest.fn() };
  const client = { ipAddress: '203.0.113.7', userAgent: 'jest' };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo.findMainServerId.mockResolvedValue('main');
    repo.findRole.mockResolvedValue({ id: 'role-hr', serverId: 'main', name: 'HR' });
    repo.findGrantsForRoles.mockResolvedValue([]);
    repo.findMemberOverrides.mockResolvedValue([]);
    repo.memberExists.mockResolvedValue(true);
    access.isRootRole.mockReturnValue(false);
    access.getEffectiveAccess.mockResolvedValue({ root: false, access: {} });

    const module = await Test.createTestingModule({
      providers: [
        AdminAccessGrantsService,
        { provide: AdminAccessRepository, useValue: repo },
        { provide: AdminAccessService, useValue: access },
        { provide: PermissionCacheService, useValue: cache },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(AdminAccessGrantsService);
  });

  describe('getCatalog', () => {
    it('lists every resource and level with a description', () => {
      const catalog = service.getCatalog();
      expect(catalog.resources).toHaveLength(14);
      expect(catalog.resources[0]).toEqual({
        key: 'servers',
        description: expect.any(String),
      });
      expect(catalog.levels.map((l) => l.key)).toEqual([
        'none',
        'read',
        'write',
        'manage',
      ]);
    });
  });

  describe('listRoles', () => {
    it('returns the main-server roles with their grants and a root flag', async () => {
      repo.listServerRoles.mockResolvedValue([
        { id: 'role-hr', name: 'HR', position: 3 },
        { id: 'role-exec', name: 'Executive', position: 9 },
      ]);
      repo.findGrantsForRoles.mockResolvedValue([
        { roleId: 'role-hr', resource: 'members', level: 'read' },
      ]);
      access.isRootRole.mockImplementation((id: string) => id === 'role-exec');

      const roles = await service.listRoles();

      expect(roles).toEqual([
        { id: 'role-hr', name: 'HR', position: 3, root: false, grants: { members: 'read' } },
        { id: 'role-exec', name: 'Executive', position: 9, root: true, grants: {} },
      ]);
    });
  });

  describe('setRoleGrants', () => {
    it('stores the grants, drops none, clears every cached admin entry and audits before and after', async () => {
      repo.findGrantsForRoles.mockResolvedValue([
        { roleId: 'role-hr', resource: 'audit', level: 'read' },
      ]);

      const result = await service.setRoleGrants(
        'actor-1',
        'role-hr',
        { members: 'read', audit: 'none', projects: 'write' },
        client,
      );

      expect(repo.replaceRoleGrants).toHaveBeenCalledWith(
        'role-hr',
        [
          { resource: 'members', level: 'read' },
          { resource: 'projects', level: 'write' },
        ],
        'actor-1',
      );
      expect(cache.invalidateAllAdminAccess).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith({
        actorId: 'actor-1',
        actionType: 'access',
        action: 'role_grants_updated',
        entityType: 'role',
        entityId: 'role-hr',
        details: {
          before: { audit: 'read' },
          after: { members: 'read', projects: 'write' },
        },
        ipAddress: '203.0.113.7',
        userAgent: 'jest',
        severity: 'info',
      });
      expect(result).toEqual({
        roleId: 'role-hr',
        grants: { members: 'read', projects: 'write' },
      });
    });

    it('rejects an unknown resource and an unknown level with 400', async () => {
      await expect(
        service.setRoleGrants('a', 'role-hr', { nope: 'read' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setRoleGrants('a', 'role-hr', { members: 'admin' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.replaceRoleGrants).not.toHaveBeenCalled();
    });

    it('returns 404 for a role that does not exist or belongs to another server', async () => {
      repo.findRole.mockResolvedValue(null);
      await expect(
        service.setRoleGrants('a', 'ghost', { members: 'read' }),
      ).rejects.toThrow(NotFoundException);

      repo.findRole.mockResolvedValue({ id: 'r', serverId: 'other', name: 'x' });
      await expect(
        service.setRoleGrants('a', 'r', { members: 'read' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to give grants to a root role', async () => {
      access.isRootRole.mockReturnValue(true);
      await expect(
        service.setRoleGrants('a', 'role-hr', { members: 'read' }),
      ).rejects.toThrow('Root roles hold full access and cannot be given grants');
      expect(repo.replaceRoleGrants).not.toHaveBeenCalled();
    });
  });

  describe('member overrides', () => {
    it('stores overrides including none, clears that member and audits', async () => {
      repo.findMemberOverrides.mockResolvedValue([
        { resource: 'stats', level: 'read' },
      ]);

      const result = await service.setMemberOverrides(
        'actor-1',
        'member-9',
        { messages: 'none', projects: 'manage' },
        client,
      );

      expect(repo.replaceMemberOverrides).toHaveBeenCalledWith(
        'member-9',
        [
          { resource: 'messages', level: 'none' },
          { resource: 'projects', level: 'manage' },
        ],
        'actor-1',
      );
      expect(cache.invalidateMember).toHaveBeenCalledWith('member-9');
      expect(audit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'member_overrides_updated',
          entityType: 'member',
          entityId: 'member-9',
          details: {
            before: { stats: 'read' },
            after: { messages: 'none', projects: 'manage' },
          },
        }),
      );
      expect(result).toEqual({
        memberId: 'member-9',
        overrides: { messages: 'none', projects: 'manage' },
      });
    });

    it('returns 404 for an unknown member', async () => {
      repo.memberExists.mockResolvedValue(false);
      await expect(
        service.setMemberOverrides('a', 'ghost', { members: 'read' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses overrides on a member who currently holds a root role', async () => {
      access.getEffectiveAccess.mockResolvedValue({ root: true, access: {} });
      await expect(
        service.setMemberOverrides('a', 'member-9', { members: 'none' }),
      ).rejects.toThrow('Root admins hold full access and cannot be given overrides');
      expect(repo.replaceMemberOverrides).not.toHaveBeenCalled();
    });

    it('removes one override, clears the member and audits', async () => {
      repo.deleteMemberOverride.mockResolvedValue(true);

      await service.removeMemberOverride('actor-1', 'member-9', 'messages', client);

      expect(repo.deleteMemberOverride).toHaveBeenCalledWith('member-9', 'messages');
      expect(cache.invalidateMember).toHaveBeenCalledWith('member-9');
      expect(audit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member_override_removed', entityId: 'member-9' }),
      );
    });

    it('returns 404 when there is no override to remove, and 400 for an unknown resource', async () => {
      repo.deleteMemberOverride.mockResolvedValue(false);
      await expect(
        service.removeMemberOverride('a', 'member-9', 'messages'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeMemberOverride('a', 'member-9', 'nope'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMemberEffective', () => {
    it('returns the resolved level and its source per resource', async () => {
      const resolved = {
        root: false,
        access: { members: { level: 'read', source: { type: 'role', roleId: 'role-hr' } } },
      };
      access.getEffectiveAccess.mockResolvedValue(resolved);

      await expect(service.getMemberEffective('member-9')).resolves.toEqual({
        memberId: 'member-9',
        ...resolved,
      });
    });

    it('returns 404 for an unknown member', async () => {
      repo.memberExists.mockResolvedValue(false);
      await expect(service.getMemberEffective('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/modules/admin-access/admin-access-grants.service.spec.ts`
Expected: FAIL, "Cannot find module './admin-access-grants.service'".

- [ ] **Step 3: Write the service**

Create `apps/api/src/modules/admin-access/admin-access-grants.service.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  LEVEL_DESCRIPTIONS,
  RESOURCE_DESCRIPTIONS,
  isAccessLevel,
  isAccessResource,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '../../common/permissions/catalog';
import type { ClientInfo } from '../../common/utils/client-info.util';
import { AuditService } from '../audit/audit.service';
import { PermissionCacheService } from '../permissions/permission-cache.service';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

type Entry<L> = { resource: AccessResource; level: L };

/**
 * Root-only editing of role grants and member overrides. Validates against
 * the catalog, refuses to touch root, clears the cache and writes an audit
 * row with the grants before and after.
 */
@Injectable()
export class AdminAccessGrantsService {
  constructor(
    private readonly repository: AdminAccessRepository,
    private readonly access: AdminAccessService,
    private readonly cache: PermissionCacheService,
    private readonly audit: AuditService,
  ) {}

  getCatalog() {
    return {
      resources: ACCESS_RESOURCES.map((key) => ({
        key,
        description: RESOURCE_DESCRIPTIONS[key],
      })),
      levels: ACCESS_LEVELS.map((key) => ({
        key,
        description: LEVEL_DESCRIPTIONS[key],
      })),
    };
  }

  async listRoles() {
    const mainServerId = await this.requireMainServer();
    const roles = await this.repository.listServerRoles(mainServerId);
    const grants = await this.repository.findGrantsForRoles(
      roles.map((r) => r.id),
    );

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      position: role.position,
      root: this.access.isRootRole(role.id),
      grants: Object.fromEntries(
        grants
          .filter((g) => g.roleId === role.id)
          .map((g) => [g.resource, g.level]),
      ),
    }));
  }

  async setRoleGrants(
    actorId: string,
    roleId: string,
    input: Record<string, unknown>,
    client?: ClientInfo,
  ) {
    const parsed = this.parse(input);
    const mainServerId = await this.requireMainServer();
    const role = await this.repository.findRole(roleId);
    if (!role || role.serverId !== mainServerId) {
      throw new NotFoundException('Role not found in the main server');
    }
    if (this.access.isRootRole(roleId)) {
      throw new BadRequestException(
        'Root roles hold full access and cannot be given grants',
      );
    }

    // A role grant is never `none`: leaving a resource out (or `none`) removes it.
    const rows = parsed.filter(
      (e): e is Entry<GrantLevel> => e.level !== 'none',
    );
    const before = await this.repository.findGrantsForRoles([roleId]);

    await this.repository.replaceRoleGrants(roleId, rows, actorId);
    await this.cache.invalidateAllAdminAccess();

    const after = this.toMap(rows);
    this.audit.logAction({
      actorId,
      actionType: 'access',
      action: 'role_grants_updated',
      entityType: 'role',
      entityId: roleId,
      details: { before: this.toMap(before), after },
      ipAddress: client?.ipAddress ?? null,
      userAgent: client?.userAgent ?? null,
      severity: 'info',
    });
    return { roleId, grants: after };
  }

  async getMemberOverrides(memberId: string) {
    await this.requireMember(memberId);
    return {
      memberId,
      overrides: this.toMap(await this.repository.findMemberOverrides(memberId)),
    };
  }

  async setMemberOverrides(
    actorId: string,
    memberId: string,
    input: Record<string, unknown>,
    client?: ClientInfo,
  ) {
    const parsed = this.parse(input);
    await this.requireMember(memberId);
    await this.refuseRootMember(memberId);

    const before = await this.repository.findMemberOverrides(memberId);
    await this.repository.replaceMemberOverrides(memberId, parsed, actorId);
    await this.cache.invalidateMember(memberId);

    const after = this.toMap(parsed);
    this.audit.logAction({
      actorId,
      actionType: 'access',
      action: 'member_overrides_updated',
      entityType: 'member',
      entityId: memberId,
      details: { before: this.toMap(before), after },
      ipAddress: client?.ipAddress ?? null,
      userAgent: client?.userAgent ?? null,
      severity: 'info',
    });
    return { memberId, overrides: after };
  }

  async removeMemberOverride(
    actorId: string,
    memberId: string,
    resource: string,
    client?: ClientInfo,
  ) {
    if (!isAccessResource(resource)) {
      throw new BadRequestException(`Unknown resource '${resource}'`);
    }
    await this.requireMember(memberId);

    const removed = await this.repository.deleteMemberOverride(memberId, resource);
    if (!removed) {
      throw new NotFoundException(`No override on '${resource}' for this member`);
    }
    await this.cache.invalidateMember(memberId);

    this.audit.logAction({
      actorId,
      actionType: 'access',
      action: 'member_override_removed',
      entityType: 'member',
      entityId: memberId,
      details: { resource },
      ipAddress: client?.ipAddress ?? null,
      userAgent: client?.userAgent ?? null,
      severity: 'info',
    });
  }

  async getMemberEffective(memberId: string) {
    await this.requireMember(memberId);
    const { root, access } = await this.access.getEffectiveAccess(memberId);
    return { memberId, root, access };
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  private parse(input: Record<string, unknown>): Entry<AccessLevel>[] {
    return Object.entries(input).map(([resource, level]) => {
      if (!isAccessResource(resource)) {
        throw new BadRequestException(`Unknown resource '${resource}'`);
      }
      if (!isAccessLevel(level)) {
        throw new BadRequestException(
          `Invalid level '${String(level)}' for '${resource}'`,
        );
      }
      return { resource, level };
    });
  }

  private toMap(entries: Array<{ resource: AccessResource; level: AccessLevel }>) {
    return Object.fromEntries(entries.map((e) => [e.resource, e.level]));
  }

  private async requireMainServer(): Promise<string> {
    const id = await this.repository.findMainServerId();
    if (!id) throw new ForbiddenException('No main server configured');
    return id;
  }

  private async requireMember(memberId: string): Promise<void> {
    if (!(await this.repository.memberExists(memberId))) {
      throw new NotFoundException('Member not found');
    }
  }

  private async refuseRootMember(memberId: string): Promise<void> {
    const { root } = await this.access.getEffectiveAccess(memberId);
    if (root) {
      throw new BadRequestException(
        'Root admins hold full access and cannot be given overrides',
      );
    }
  }
}
```


- [ ] **Step 4: Run the test and typecheck**

Run: `pnpm --filter @mcdi/api exec jest src/modules/admin-access/admin-access-grants.service.spec.ts && pnpm --filter @mcdi/api run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin-access
git commit -m "feat(api): add root-only grant editing with validation, root lock and audit"
```

---

### Task 12: Grant-management controller

**Files:**
- Create: `apps/api/src/modules/admin-access/dto/set-grants.dto.ts`
- Create: `apps/api/src/modules/admin-access/admin-access.controller.ts`
- Modify: `apps/api/src/modules/admin-access/admin-access.module.ts`
- Test: `apps/api/src/modules/admin-access/admin-access.controller.spec.ts`

**Interfaces:**
- Consumes: `AdminAccessGrantsService` (Task 11), `AdminAccessGuard`, `RootOnly` (Task 6), `extractClientInfo`.
- Produces: the seven `/admin/access` routes of the spec, which are added to `EXPECTED` in `admin-access-coverage.spec.ts` (Step 6).

- [ ] **Step 1: Write the failing controller test**

Create `apps/api/src/modules/admin-access/admin-access.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { AdminAccessController } from './admin-access.controller';
import { AdminAccessGrantsService } from './admin-access-grants.service';

describe('AdminAccessController', () => {
  let controller: AdminAccessController;
  const grants = {
    getCatalog: jest.fn(),
    listRoles: jest.fn(),
    setRoleGrants: jest.fn(),
    getMemberOverrides: jest.fn(),
    setMemberOverrides: jest.fn(),
    removeMemberOverride: jest.fn(),
    getMemberEffective: jest.fn(),
  };
  const req = {
    memberId: 'actor-1',
    headers: { 'user-agent': 'jest' },
    ip: '203.0.113.7',
  } as never;
  const client = { ipAddress: '203.0.113.7', userAgent: 'jest' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AdminAccessController],
      providers: [{ provide: AdminAccessGrantsService, useValue: grants }],
    })
      .overrideGuard(AdminAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AdminAccessController);
  });

  it('serves the catalog and the role list', async () => {
    grants.getCatalog.mockReturnValue({ resources: [], levels: [] });
    grants.listRoles.mockResolvedValue([{ id: 'r' }]);

    expect(controller.getCatalog()).toEqual({ resources: [], levels: [] });
    await expect(controller.listRoles()).resolves.toEqual([{ id: 'r' }]);
  });

  it('passes the acting admin and client info when setting role grants', async () => {
    grants.setRoleGrants.mockResolvedValue({ roleId: 'r', grants: {} });

    await controller.setRoleGrants('r', { grants: { members: 'read' } }, req);

    expect(grants.setRoleGrants).toHaveBeenCalledWith(
      'actor-1',
      'r',
      { members: 'read' },
      client,
    );
  });

  it('passes the acting admin when setting member overrides and removing one', async () => {
    grants.setMemberOverrides.mockResolvedValue({});
    grants.removeMemberOverride.mockResolvedValue(undefined);

    await controller.setMemberOverrides('m', { grants: { messages: 'none' } }, req);
    await controller.removeMemberOverride('m', 'messages', req);

    expect(grants.setMemberOverrides).toHaveBeenCalledWith(
      'actor-1',
      'm',
      { messages: 'none' },
      client,
    );
    expect(grants.removeMemberOverride).toHaveBeenCalledWith(
      'actor-1',
      'm',
      'messages',
      client,
    );
  });

  it('reads a member overrides and effective access', async () => {
    grants.getMemberOverrides.mockResolvedValue({ memberId: 'm', overrides: {} });
    grants.getMemberEffective.mockResolvedValue({ memberId: 'm', root: false });

    await expect(controller.getMemberOverrides('m')).resolves.toEqual({
      memberId: 'm',
      overrides: {},
    });
    await expect(controller.getMemberEffective('m')).resolves.toEqual({
      memberId: 'm',
      root: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mcdi/api exec jest src/modules/admin-access/admin-access.controller.spec.ts`
Expected: FAIL, "Cannot find module './admin-access.controller'".

- [ ] **Step 3: Create the DTO**

Create `apps/api/src/modules/admin-access/dto/set-grants.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { ACCESS_LEVELS } from '../../../common/permissions/catalog';

export class SetGrantsDto {
  @ApiProperty({
    description:
      'Level per resource. Resources not listed get no grant. For a role, `none` removes the grant. For a member, `none` denies access that the roles would give.',
    type: 'object',
    additionalProperties: { type: 'string', enum: [...ACCESS_LEVELS] },
    example: { members: 'read', audit: 'read', messages: 'none' },
  })
  @IsObject()
  grants: Record<string, string>;
}
```

- [ ] **Step 4: Create the controller**

Create `apps/api/src/modules/admin-access/admin-access.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RootOnly } from '../../common/decorators/admin-access.decorator';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { extractClientInfo } from '../../common/utils/client-info.util';
import { AdminAccessGrantsService } from './admin-access-grants.service';
import { SetGrantsDto } from './dto/set-grants.dto';

type RequestWithMember = Request & { memberId: string };

/**
 * Who may do what in the admin API. Root admins only: this is not a catalog
 * resource, so it cannot be granted to anyone else.
 */
@ApiTags('Admin Access')
@ApiBearerAuth('session-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid admin session.' })
@ApiForbiddenResponse({ description: 'Root admin access required.' })
@Controller('admin/access')
@UseGuards(AdminAccessGuard)
@RootOnly()
export class AdminAccessController {
  constructor(private readonly grants: AdminAccessGrantsService) {}

  @Get('catalog')
  @ApiOperation({
    summary: 'List the admin resources and levels',
    description: 'The resources a grant can name and the four levels, with descriptions.',
  })
  @ApiOkResponse({ description: 'Resources and levels.' })
  getCatalog() {
    return this.grants.getCatalog();
  }

  @Get('roles')
  @ApiOperation({
    summary: 'List main-server roles with their grants',
    description: 'Root roles are flagged and cannot be given grants.',
  })
  @ApiOkResponse({ description: 'Roles with their grants.' })
  listRoles() {
    return this.grants.listRoles();
  }

  @Put('roles/:roleId')
  @ApiOperation({
    summary: 'Replace a role\'s grants',
    description:
      'Replaces every grant of the role. Resources left out, or set to `none`, have no grant.',
  })
  @ApiOkResponse({ description: 'The grants now held by the role.' })
  @ApiBadRequestResponse({ description: 'Unknown resource or level, or a root role.' })
  @ApiNotFoundResponse({ description: 'Role not found in the main server.' })
  setRoleGrants(
    @Param('roleId') roleId: string,
    @Body() dto: SetGrantsDto,
    @Req() req: RequestWithMember,
  ) {
    return this.grants.setRoleGrants(
      req.memberId,
      roleId,
      dto.grants,
      extractClientInfo(req),
    );
  }

  @Get('members/:memberId')
  @ApiOperation({ summary: 'Get a member\'s overrides' })
  @ApiOkResponse({ description: 'The overrides of the member.' })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  getMemberOverrides(@Param('memberId') memberId: string) {
    return this.grants.getMemberOverrides(memberId);
  }

  @Put('members/:memberId')
  @ApiOperation({
    summary: 'Replace a member\'s overrides',
    description:
      'An override replaces what the roles grant for that resource, for this member only. `none` denies.',
  })
  @ApiOkResponse({ description: 'The overrides now held by the member.' })
  @ApiBadRequestResponse({ description: 'Unknown resource or level, or a root member.' })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  setMemberOverrides(
    @Param('memberId') memberId: string,
    @Body() dto: SetGrantsDto,
    @Req() req: RequestWithMember,
  ) {
    return this.grants.setMemberOverrides(
      req.memberId,
      memberId,
      dto.grants,
      extractClientInfo(req),
    );
  }

  @Delete('members/:memberId/:resource')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove one override',
    description: 'The member falls back to what their roles grant for that resource.',
  })
  @ApiNoContentResponse({ description: 'Override removed.' })
  @ApiBadRequestResponse({ description: 'Unknown resource.' })
  @ApiNotFoundResponse({ description: 'Member or override not found.' })
  removeMemberOverride(
    @Param('memberId') memberId: string,
    @Param('resource') resource: string,
    @Req() req: RequestWithMember,
  ) {
    return this.grants.removeMemberOverride(
      req.memberId,
      memberId,
      resource,
      extractClientInfo(req),
    );
  }

  @Get('members/:memberId/effective')
  @ApiOperation({
    summary: 'Explain a member\'s effective access',
    description:
      'The resolved level per resource and where it comes from: root, an override, or the role that supplied it.',
  })
  @ApiOkResponse({ description: 'Effective access with sources.' })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  getMemberEffective(@Param('memberId') memberId: string) {
    return this.grants.getMemberEffective(memberId);
  }
}
```

- [ ] **Step 5: Register the controller and the grants service in the module**

Replace `admin-access.module.ts` with:

```ts
import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AdminAccessController } from './admin-access.controller';
import { AdminAccessGrantsService } from './admin-access-grants.service';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

/**
 * Global so that `AdminAccessGuard`, which many modules apply with
 * `@UseGuards`, can resolve `AdminAccessService` without each module
 * importing this one.
 */
@Global()
@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [AdminAccessController],
  providers: [
    AdminAccessRepository,
    AdminAccessService,
    AdminAccessGrantsService,
  ],
  exports: [AdminAccessService],
})
export class AdminAccessModule {}
```

- [ ] **Step 6: Pin the new routes in the classification test**

In `apps/api/src/common/guards/admin-access-coverage.spec.ts`, add these entries at the end of the `EXPECTED` object (after the `// own data` block):

```ts
  // grant management: root only
  'GET /admin/access/catalog': 'root',
  'GET /admin/access/roles': 'root',
  'PUT /admin/access/roles/:roleId': 'root',
  'GET /admin/access/members/:memberId': 'root',
  'PUT /admin/access/members/:memberId': 'root',
  'DELETE /admin/access/members/:memberId/:resource': 'root',
  'GET /admin/access/members/:memberId/effective': 'root',
```

- [ ] **Step 7: Run the controller spec, the coverage spec and typecheck**

Run:

```bash
pnpm --filter @mcdi/api exec jest src/modules/admin-access src/common/guards
pnpm --filter @mcdi/api run typecheck
```

Expected: all PASS, including `admin-access-coverage.spec.ts` (all 85 admin routes now match the spec table).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/admin-access
git add apps/api/src/common/guards/admin-access-coverage.spec.ts
git commit -m "feat(api): add the root-only /admin/access grant management API"
```

---

### Task 13: End-to-end tests

**Files:**
- Modify: `apps/api/test/helpers/db.ts` (add `seedNonRootMember`)
- Create: `apps/api/test/admin-access.e2e-spec.ts`

Settings endpoints are used for the level checks because they need no Discord and have a read, a write and a manage endpoint (`GET`, `PATCH`, `POST reset`). The e2e suite runs against real Postgres and Redis. The permission cache lives in Redis, which `clearAllTables` does not touch, so the test flushes it before each test.

- [x] **Step 1: The helper already exists.** `seedNonRootMember` and `MemberContext` were added to `apps/api/test/helpers/db.ts` in PR B, together with `test/admin-access-guard.e2e-spec.ts`, which already covers: no session gives 401, a member with no grant signs in to `/auth/admin/me` with every level `none` and is refused on admin endpoints, and root works. Do not add them again. The suite below only covers granting.

- [ ] **Step 2: Write the e2e suite**

Create `apps/api/test/admin-access.e2e-spec.ts`:

```ts
/**
 * E2E: admin access levels (/api/admin/access/*, and enforcement on admin routes).
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`) and Redis.
 * Root is the Executive role seeded by `seedAdminContext`
 * (MC_EXECUTIVE_ROLE_ID is set in `createTestApp`).
 */
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import {
  AdminContext,
  MemberContext,
  clearAllTables,
  closeTestDb,
  getTestDb,
  seedAdminContext,
  seedNonRootMember,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';
import { PermissionCacheService } from '../src/modules/permissions/permission-cache.service';
import { auditLogs } from '../src/database/entities';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/admin/access and level enforcement (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let root: AdminContext;
  let dev: MemberContext;

  beforeAll(async () => {
    enableNock();
    db = getTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    disableNock();
    await closeTestDb();
    await app.close();
  });

  beforeEach(async () => {
    await clearAllTables(db);
    // Admin access is cached in Redis, which clearAllTables does not touch.
    await app.get(PermissionCacheService).clear();
    root = await seedAdminContext(db);
    dev = await seedNonRootMember(db, root.serverId);
  });

  const as = (token: string) => `Bearer ${token}`;
  const http = () => request(app.getHttpServer());

  const grantRole = (grants: Record<string, string>) =>
    http()
      .put(`/api/admin/access/roles/${dev.roleId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants })
      .expect(200);

  it('lets a member with no grant sign in to /auth/admin/me but nothing else', async () => {
    const me = await http()
      .get('/api/auth/admin/me')
      .set('Authorization', as(dev.bearerToken))
      .expect(200);
    expect(me.body.root).toBe(false);
    expect(me.body.permissions.members).toBe('none');

    await http()
      .get('/api/admin/settings')
      .set('Authorization', as(dev.bearerToken))
      .expect(403);
  });

  it('reports root and manage everywhere for a root admin', async () => {
    const me = await http()
      .get('/api/auth/admin/me')
      .set('Authorization', as(root.bearerToken))
      .expect(200);
    expect(me.body.root).toBe(true);
    expect(me.body.permissions.settings).toBe('manage');
  });

  it('enforces read, write and manage on the settings endpoints, cumulatively', async () => {
    await grantRole({ settings: 'read' });
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(200);
    await http()
      .patch('/api/admin/settings')
      .set('Authorization', as(dev.bearerToken))
      .send({ maxWebhooksPerProject: 5 })
      .expect(403);

    await grantRole({ settings: 'write' });
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(200);
    await http()
      .patch('/api/admin/settings')
      .set('Authorization', as(dev.bearerToken))
      .send({ maxWebhooksPerProject: 5 })
      .expect(200);
    await http()
      .post('/api/admin/settings/reset')
      .set('Authorization', as(dev.bearerToken))
      .expect(403);

    await grantRole({ settings: 'manage' });
    await http()
      .post('/api/admin/settings/reset')
      .set('Authorization', as(dev.bearerToken))
      .expect(200);
  });

  it('applies a grant change on the very next request', async () => {
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(403);
    await grantRole({ settings: 'read' });
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(200);
    await grantRole({});
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(403);
  });

  it('lets a member override raise, lower and deny relative to the role', async () => {
    await grantRole({ settings: 'read' });

    await http()
      .put(`/api/admin/access/members/${dev.memberId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { settings: 'manage' } })
      .expect(200);
    await http()
      .post('/api/admin/settings/reset')
      .set('Authorization', as(dev.bearerToken))
      .expect(200);

    await http()
      .put(`/api/admin/access/members/${dev.memberId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { settings: 'none' } })
      .expect(200);
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(403);

    await http()
      .delete(`/api/admin/access/members/${dev.memberId}/settings`)
      .set('Authorization', as(root.bearerToken))
      .expect(204);
    await http().get('/api/admin/settings').set('Authorization', as(dev.bearerToken)).expect(200);
  });

  it('explains where an effective level comes from', async () => {
    await grantRole({ members: 'read' });

    const res = await http()
      .get(`/api/admin/access/members/${dev.memberId}/effective`)
      .set('Authorization', as(root.bearerToken))
      .expect(200);

    expect(res.body.root).toBe(false);
    expect(res.body.access.members).toEqual({
      level: 'read',
      source: { type: 'role', roleId: dev.roleId },
    });
  });

  it('keeps grant management root-only, even for a member with manage on everything', async () => {
    await grantRole(
      Object.fromEntries(
        [
          'servers', 'members', 'channels', 'messages', 'roles', 'projects',
          'project_keys', 'webhooks', 'inbound_webhooks', 'sync', 'stats',
          'audit', 'monitoring', 'settings',
        ].map((r) => [r, 'manage']),
      ),
    );

    await http().get('/api/admin/access/catalog').set('Authorization', as(dev.bearerToken)).expect(403);
    await http()
      .put(`/api/admin/access/roles/${dev.roleId}`)
      .set('Authorization', as(dev.bearerToken))
      .send({ grants: {} })
      .expect(403);
  });

  it('locks root: no grants on a root role, no overrides on a root member', async () => {
    await http()
      .put(`/api/admin/access/roles/${root.roleId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { members: 'read' } })
      .expect(400);
    await http()
      .put(`/api/admin/access/members/${root.memberId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { members: 'none' } })
      .expect(400);
  });

  it('rejects unknown resources and levels with 400', async () => {
    await http()
      .put(`/api/admin/access/roles/${dev.roleId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { nope: 'read' } })
      .expect(400);
    await http()
      .put(`/api/admin/access/roles/${dev.roleId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { members: 'admin' } })
      .expect(400);
  });

  it('writes an audit row with the grants before and after', async () => {
    await grantRole({ members: 'read' });
    await grantRole({ members: 'write', audit: 'read' });
    // logAction is fire and forget
    await new Promise((resolve) => setTimeout(resolve, 200));

    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actionType, 'access'));

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(
      expect.objectContaining({
        action: 'role_grants_updated',
        actorId: root.memberId,
        entityId: dev.roleId,
        details: {
          before: { members: 'read' },
          after: { members: 'write', audit: 'read' },
        },
      }),
    );
  });

  it('refuses an unauthenticated request', async () => {
    await http().get('/api/admin/access/catalog').expect(401);
  });
});
```

- [ ] **Step 3: Run the e2e suite against a fresh database**

Run:

```bash
cd apps/api
RESET_DB=1 pnpm run db:migrate
pnpm run test:e2e -- admin-access
```

Expected: PASS (11 tests). If the app fails to boot with a circular dependency error between `AdminAccessModule` and `PermissionsModule`, wrap the `PermissionsModule` import in `AdminAccessModule` as `forwardRef(() => PermissionsModule)` and re-run.

- [ ] **Step 4: Run the whole e2e suite**

Run: `cd apps/api && RESET_DB=1 pnpm run db:migrate && pnpm run test:e2e`
Expected: PASS. The existing admin e2e suites (members, settings, permissions, sync) keep working because their admin is root.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/api/test
git commit -m "test(api): cover admin access levels end to end"
```

---

### Task 14: Documentation

Part of PR C. PR B already updated, for what it changed: the architecture admin paragraph and guard table, `local-setup.mdx` (sign-in sentence and the three root-role descriptions), the glossary, the older admin decision, `testing.mdx`, `api-guide.mdx`, `CLAUDE.md`, `apps/api/README.md` and the regenerated API reference for `/auth/admin/me`. Steps 1 and 2 below therefore only add what PR C introduces: the `/admin/access` sentence in the architecture paragraph, and the new decision entry. Skip any edit that is already in place.

**Files:**
- Modify: `apps/web/src/content/docs/build/architecture.mdx`, `build/local-setup.mdx`, `build/decisions.mdx`
- Modify: `docs/superpowers/specs/2026-10-07-admin-permissions-design.md` (one sentence)
- Regenerate: the API reference (`pnpm docs:api`) and `apps/api/openapi.json`

Prose rules: plain hyphens, no em or en dashes, present tense, describe what the code does.

- [ ] **Step 1: Architecture page**

In `build/architecture.mdx`, replace the paragraph that starts `**Admins.** Admins sign in with Discord OAuth.` with:

```
**Admins.** Admins sign in with Discord OAuth. Any member of the main server can sign in. What they can do depends on the level their roles grant on each admin resource: `none`, `read`, `write` or `manage`, each including the one before it. `AdminAccessGuard` accepts only sessions issued by the admin login, never one a project holds, then compares the member's effective level on the endpoint's resource with the level the endpoint declares through `@RequirePermission`. An endpoint with no declaration is refused. A person's override replaces what their roles grant for that resource. Members who hold `MC_EXECUTIVE_ROLE_ID`, `MC_DEV_LEADS_ROLE_ID` or `MC_IT_LEADS_ROLE_ID` are root: they hold `manage` on everything and are the only ones who can edit grants, through `/api/admin/access`. The admin panel sends the session as the `admin_session` httpOnly cookie, and curl or Swagger can send it as `Authorization: Bearer`. `GET /api/auth/admin/me` returns the member's effective level per resource, which the panel uses to build its navigation.
```

Append `` `apps/api/src/modules/admin-access` ``, `` `apps/api/src/common/permissions` `` and `` `apps/api/src/common/guards/admin-access.guard.ts` `` to the final `Source:` line of the page (inside the list, before the closing period).

- [ ] **Step 2: Local setup page**

In `build/local-setup.mdx`:

- Replace the sentence `MCDI lets you in when you belong to the main server (`MC_GUILD_ID`) and hold `MC_EXECUTIVE_ROLE_ID`, or the optional `MC_DEV_LEADS_ROLE_ID` or `MC_IT_LEADS_ROLE_ID`.` with `MCDI lets you sign in when you belong to the main server (`MC_GUILD_ID`). You see everything when you hold `MC_EXECUTIVE_ROLE_ID`, or the optional `MC_DEV_LEADS_ROLE_ID` or `MC_IT_LEADS_ROLE_ID`, which make you a root admin. Any other member signs in with no access until a root admin grants their role some.`
- In the environment table, change the three descriptions to: `MC_EXECUTIVE_ROLE_ID` → `The root role in the main server: full access to the admin API, and the only one that edits grants.`; `MC_DEV_LEADS_ROLE_ID` → `An extra root role in the main server.`; `MC_IT_LEADS_ROLE_ID` → `Another extra root role.`

- [ ] **Step 3: Decision record**

In `build/decisions.mdx`, insert this entry before `## Add a decision`:

```
## Admin access is a level per resource, and root is a Discord role

**Context.** Every admin endpoint sat behind one check: hold the Executive, Dev Lead or IT Lead role. Access was all or nothing, the club could not hide sensitive data such as messages or API keys from some people while showing it to others, and the list of admins was fixed by environment variables.

**Decision.** Each admin resource (members, messages, projects, project keys and so on) has a level per role: `none`, `read`, `write` or `manage`, each including the previous one. A grant to a person replaces their roles' level for that resource only. Any main-server member can sign in, and a request is allowed when the effective level reaches the level the endpoint declares. An endpoint with no declaration is refused. The three env roles stay as root: full access, not editable in the platform, and the only ones who edit grants.

**Consequences.** A new admin endpoint must declare a resource and a level, and a test fails when it does not. Effective access is cached in Redis with the other permission caches, so role changes in Discord and grant edits reach the guard on the next request. Root is still a Discord role, so whoever can assign roles in Discord can grant it. Project API keys keep their own per-project, per-server rules.

**Links.** Design: `docs/superpowers/specs/2026-10-07-admin-permissions-design.md`. Follow-up issues: #193, #194, #195 and #196.
```

- [ ] **Step 4: One spec sentence**

In `docs/superpowers/specs/2026-10-07-admin-permissions-design.md`, in the Enforcement section, change `` `SystemAdminGuard` and its spec are deleted once nothing uses them. `isAdminMember` becomes the root check. `` to `` `SystemAdminGuard`, its spec and the `isAdminMember` helper are deleted once nothing uses them. The root check lives in `AdminAccessService`. ``

- [ ] **Step 5: Regenerate the API reference**

Run: `pnpm docs:api`
Expected: `apps/api/openapi.json` and the generated pages under `apps/web/src/content/docs/api-reference` change (new `Admin Access` pages, the new `/auth/admin/me` fields). Review `git diff --stat` and confirm nothing unrelated changed.

- [ ] **Step 6: Run the docs tests**

Run: `pnpm --filter @mcdi/web exec vitest run tests/features/docs`
Expected: PASS (every page registered, every env var documented, excerpts in sync).

- [ ] **Step 7: Commit**

```bash
git add apps/web apps/api/openapi.json docs
git commit -m "docs: describe admin access levels and root"
```

---

### Task 15: Verification and pull request (run once per PR)

**Running the e2e suite locally.** The suite truncates every table and the app would try to log the real Discord bot in from `apps/api/.env`. Use a throwaway database and blank tokens, for example:

```bash
psql postgresql://myuser:mypassword@localhost:5432/mcdi -c "create database mcdi_test"
cd apps/api && set -a && . ./.env && set +a
export DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mcdi_test \
  REDIS_HOST=localhost REDIS_KEY_PREFIX=mcdi_test DISCORD_TOKEN= DISCORD_BOT_TOKEN=
pnpm run db:migrate && pnpm run test:e2e
```

Never run the e2e suite against the development database, and do not use `RESET_DB=1` on it.

**Do not run `pnpm build` in a shell where `apps/api/.env` was sourced.** That file sets `NODE_ENV=development`, and `next build` then fails prerendering with "Cannot read properties of null (reading 'useState')". Run the build in a clean shell.

**`eslint --fix` on whole directories reformats unrelated files** (pre-existing style drift, for example `sync-log.service.ts`). Run it only on the files you changed, or revert unrelated files with `git checkout -- <file>` before committing.

**Sweep for stale statements.** After a behavior change, search the docs and comments for the old rule: `grep -rn "<old name or phrase>" apps/web/src/content/docs CLAUDE.md apps/api/README.md apps/api/src apps/api/test`. `docs/` (specs and PRDs) is historical and not updated.

**Formatting.** Code copied from this plan is not prettier-formatted. Run `pnpm exec eslint --fix` on the files you added or changed before committing, then re-run the tests.

Run the steps below at the end of each of PR A, B and C, on that PR's branch. For PR A skip the e2e run and the `docs:api` regeneration; for PR B run the full e2e suite; PR C runs everything. In Step 4 use the branch and title of the PR you are opening (see "Delivery in three pull requests") and describe only what that PR contains.

- [ ] **Step 1: Lint (this script runs `--fix`), typecheck, unit tests with coverage**

Run:

```bash
pnpm lint
git status --short
pnpm typecheck
pnpm --filter @mcdi/api exec jest --config jest.config.cjs --coverage
```

Expected: lint passes (review any file it auto-fixed with `git diff` and commit those fixes), typecheck passes, all unit tests pass, coverage thresholds hold.

- [ ] **Step 2: Full e2e and build**

Run:

```bash
cd apps/api && RESET_DB=1 pnpm run db:migrate && pnpm run test:e2e && cd ../..
pnpm build
pnpm --filter @mcdi/web exec vitest run
```

Expected: all PASS.

- [ ] **Step 3: Confirm the old guard is gone and every admin route is classified**

Run: `grep -rn "SystemAdminGuard" apps docs --include=*.ts --include=*.mdx --include=*.md | grep -v "docs/superpowers"`
Expected: no output (the spec and plan under `docs/superpowers` mention it historically).

- [ ] **Step 4: Push and open the pull request to `dev`**

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin benabdou/admin-permissions-spec
gh pr create --base dev --head benabdou/admin-permissions-spec \
  --title "feat(api): read/write/manage permissions on admin endpoints" \
  --body "## Summary
- Replaces the all-or-nothing \`SystemAdminGuard\` with a level per admin resource (\`none\`, \`read\`, \`write\`, \`manage\`, cumulative) granted to Discord roles, with per-person overrides.
- Any main-server member can sign in; what they see and do follows their grants. The three env roles stay as root and are the only ones who edit grants (\`/api/admin/access\`).
- Every admin endpoint declares a resource and level; an undeclared endpoint is refused, and a test pins the classification of every route.
- Effective access is cached with the permission cache, so the sync handlers' existing invalidation clears it (addresses #194).
- Design: \`docs/superpowers/specs/2026-10-07-admin-permissions-design.md\`. Plan: \`docs/superpowers/plans/2026-10-07-admin-permissions.md\`.

## Test plan
- [x] Unit tests, including the resolver, the guard (fail closed) and the route-classification test
- [x] E2E: levels on the settings endpoints, overrides, root lock, root-only grant management, audit rows
- [x] Migration applied twice (idempotent)
- [x] \`pnpm lint\`, \`pnpm typecheck\`, \`pnpm build\`, web docs tests"
```

Expected: the PR URL is printed. The commit messages and the PR body carry no Claude signature.
