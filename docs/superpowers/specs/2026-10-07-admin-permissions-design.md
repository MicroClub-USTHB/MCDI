# Admin permissions: read, write and manage per resource

Status: design approved in brainstorming, awaiting spec review.
Scope: the API (`apps/api`) only. The admin panel changes are a separate spec (see "Out of scope").

## Problem

Every admin endpoint sits behind `SystemAdminGuard`, which answers one yes/no question: does the member hold the Executive, Dev Lead or IT Lead Discord role in the main server. The same three roles are also checked at admin login (`AdminAuthService`), so anyone without one cannot sign in at all.

The club wants to limit who can see sensitive data (member details, message contents, API keys) and to let people outside those three roles use the admin panel, for example HR, without giving them everything. Today that is impossible: access is all or nothing, and the list of admins is fixed by environment variables.

## Goals

- Classify every admin endpoint under a resource and a level (`read`, `write`, `manage`).
- Let root admins grant a level per resource to a Discord role, and override it for a single person.
- Make the permission system the only gate to the admin API. The env admin roles stop deciding who is an admin.
- Fail closed: an admin endpoint with no declared permission is never reachable.

## Non-goals

- No development bypass or "dev mode" switch. Development uses the same system, against the fake Discord server and fake roles the team already uses.
- No change to project API-key endpoints (`ApiKeyGuard`, `operations`, `scopes`). They keep their own model.
- No change to end-user session endpoints or the `/auth/*` login flows, other than the admin login gate described below.
- No delegation of grant editing. Only root edits grants, for now.

## Decisions taken

| Question | Decision |
|---|---|
| Who holds permissions | Discord roles, with per-person overrides that replace the role's level for that person |
| Dev on/off switch | None. The permission system itself is the mechanism |
| Endpoints covered | Admin endpoints only |
| Who edits grants | Root roles only: the env roles `MC_EXECUTIVE_ROLE_ID`, `MC_DEV_LEADS_ROLE_ID`, `MC_IT_LEADS_ROLE_ID` (confirmed by the club president) |
| Storage model | One level per resource: `(subject, resource, level)` with `none < read < write < manage` |
| Resource split | `messages` is separate from `channels`, and `project_keys` is separate from `projects` |

## Levels

Levels are cumulative. A higher level includes everything below it.

In practice a single grant is enough: a role or member with `manage` on a resource can call every `write` and `read` endpoint of that resource, and `write` includes every `read` endpoint. Nobody needs separate read or write rows alongside a `manage` row, and the system stores exactly one level per subject and resource. The check is an ordered comparison (`none < read < write < manage`), so an endpoint that needs `read` accepts `read`, `write` and `manage`.

| Level | Meaning |
|---|---|
| `none` | No access. As an override it denies access that the role would grant |
| `read` | Look only. Includes dry-run previews and exports |
| `write` | `read`, plus create, update and non-destructive state changes, including triggering a sync |
| `manage` | `write`, plus anything destructive or irreversible: delete, reset, revoke |

Classification rule for endpoints that are not plain CRUD: if it only reads or previews, it is `read`. If it changes state and can be undone, it is `write`. If it removes or cannot be undone, it is `manage`.

## Resources and endpoint classification

The catalog lives in code (`apps/api/src/common/permissions/catalog.ts`), not in the database. A new endpoint needs code anyway, so a resources table would add nothing.

A cell that says "none today" means no endpoint needs that level yet. A grant at that level behaves like the level below until an endpoint is added.

### `servers`
- `read`: `GET /servers`, `GET /servers/:serverId`
- `write`: `POST /servers`, `PATCH /servers/:serverId`, `PATCH /servers/:serverId/disable`, `PATCH /servers/:serverId/enable`
- `manage`: `DELETE /servers/:serverId`

### `members`
- `read`: `GET /admin/members`, `GET /admin/members/cross-server`, `GET /admin/members/export`, `GET /admin/members/:discordId/servers`
- `write`, `manage`: none today

### `channels`
- `read`: `GET /admin/servers/:serverId/channels`, `GET /admin/servers/:serverId/channels/:channelId`
- `write`, `manage`: none today

### `messages`
- `read`: `GET /admin/servers/:serverId/channels/:channelId/messages`
- `write`, `manage`: none today

### `roles` (roles, permissions and inheritance rules)
- `read`: `GET /permissions/inheritance-rules`, `GET /permissions/admin/servers/:serverId/roles/:roleId/permissions`, `POST /permissions/admin/servers/:serverId/roles/:roleId/impact` (read-only preview)
- `write`: `POST /permissions/inheritance-rules` (upsert), `POST /permissions/admin/servers/:serverId/roles/:roleId/permissions`
- `manage`: `DELETE /permissions/admin/servers/:serverId/roles/:roleId/permissions/:permissionId`

### `projects`
- `read`: `GET /admin/projects`, `GET /admin/projects/:id`, `GET /admin/projects/:projectId/servers`, `GET /admin/projects/servers/:serverId/projects`, `GET /admin/projects/access/matrix`, `GET /admin/projects/access/audit`
- `write`: `POST /admin/projects`, `PATCH /admin/projects/:id`, `PATCH /admin/projects/:id/redirect-uri`, `PUT /admin/projects/:projectId/servers/:serverId`
- `manage`: `DELETE /admin/projects/:id`, `DELETE /admin/projects/:projectId/servers/:serverId`

### `project_keys`
- `read`: `GET /admin/projects/:id/api-key` (prefix and metadata only, never the secret)
- `write`: `POST /admin/projects/:id/regenerate-api-key`, `POST /admin/projects/:id/restore-key`
- `manage`: `DELETE /admin/projects/:id/key`

### `webhooks` (outbound Discord webhooks)
- `read`: `GET /admin/projects/:projectId/webhooks`, `GET /admin/webhooks/:webhookId`
- `write`: none today
- `manage`: `DELETE /admin/webhooks/:webhookId`

### `inbound_webhooks`
- `read`: `GET /admin/inbound-webhooks`, `GET /admin/inbound-webhooks/settings`, `GET /admin/inbound-webhooks/:id`, `GET /admin/inbound-webhooks/:id/docs`, `GET /admin/inbound-webhooks/:id/roles`, `POST /admin/inbound-webhooks/schema/preview` (no persistence)
- `write`: `POST /admin/inbound-webhooks`, `PUT /admin/inbound-webhooks/settings`, `PATCH /admin/inbound-webhooks/:id`, `PUT /admin/inbound-webhooks/:id/roles`, `POST /admin/inbound-webhooks/:id/rotate-secret`
- `manage`: `DELETE /admin/inbound-webhooks/:id`

`rotate-secret` is `write` because it is recoverable: the old secret stops working and a new one exists.

### `sync`
- `read`: `GET /admin/sync/status`, `GET /admin/sync/status/all`, `GET /admin/sync/logs`, `GET /admin/sync/logs/:syncLogId/changes`
- `write`: `POST /admin/sync/full`
- `manage`: none today

### `stats`
- `read`: all `GET /admin/stats/*`, including `export`
- `write`, `manage`: none

### `audit`
- `read`: `GET /admin/audit/logs`, `GET /admin/audit/logs/export`
- `write`, `manage`: none

### `monitoring`
- `read`: `GET /admin/monitoring/health`, `GET /admin/monitoring/usage`, `GET /admin/monitoring/auth-failures`
- `write`, `manage`: none

### `settings`
- `read`: `GET /admin/settings`
- `write`: `PATCH /admin/settings`
- `manage`: `POST /admin/settings/reset`

### Session-only endpoints
These need a valid admin session but no resource level, because they act on the caller's own data: `GET` and `PATCH /admin/profile`, `GET /auth/admin/me`, `POST /auth/admin/logout`.

### Root-only endpoints
The grant-management endpoints below. They are not a catalog resource, so they cannot be delegated by granting a level.

## Data model

Two new tables. The names avoid the existing `permissions` and `role_permissions` tables, which belong to the member permission-check API.

```
admin_role_access
  role_id     varchar  references roles(id) on delete cascade
  resource    varchar  not null   -- a catalog key
  level       varchar  not null   -- 'read' | 'write' | 'manage'
  updated_at  timestamptz
  updated_by  varchar             -- member id of the root admin, no FK (as app_settings)
  primary key (role_id, resource)

admin_member_access
  member_id   varchar  references members(id) on delete cascade
  resource    varchar  not null
  level       varchar  not null   -- 'none' | 'read' | 'write' | 'manage'
  updated_at  timestamptz
  updated_by  varchar
  primary key (member_id, resource)
```

- `none` is stored only in `admin_member_access`, where it means "deny". In `admin_role_access` setting `none` deletes the row.
- Role grants apply only to roles of the main server (`servers.is_main`). Grants on roles of other servers are rejected.
- Resource and level values are validated against the catalog in code. A check constraint on `level` guards the database.
- One migration (the next number after `0005`), generated with `pnpm run db:generate`. It seeds nothing.

## Resolution

For one request that needs `required` on `resource`:

1. If the member holds a root role in the main server, the effective level is `manage`.
2. Else, if `admin_member_access` has a row for `(member, resource)`, that level is final, even when lower than the role's.
3. Else the effective level is the highest level across `admin_role_access` rows for the member's main-server roles, or `none` when there are none.
4. The request is allowed when the effective level is at least `required`.

The member's roles come from the synced `server_member_roles`, which login and the sync gateway events already keep current.

### Caching
The effective-permission map for a member is cached in Redis with a short TTL, using the existing permission-cache pattern and TTL setting. Any change to `admin_role_access` or `admin_member_access` invalidates the affected entries (a role change invalidates every member holding that role). When Redis is unavailable the guard reads the database.

## Enforcement

- New decorator `@RequirePermission(resource, level)` on every admin handler.
- New decorators `@AdminSessionOnly()` and `@RootOnly()` for the two exceptions above.
- New `AdminAccessGuard` replaces `SystemAdminGuard` on every controller that uses it today. It validates the admin session as `SystemAdminGuard` does (token from the `Authorization` header or the `admin_session` cookie, `adminOnly: true`), sets `request.memberId`, then resolves the level.
- Fail closed: a handler with none of the three decorators is rejected with 403 and a logged error.
- Responses: 401 for a missing or invalid session, 403 with the resource and required level in the message when the effective level is too low.
- `SystemAdminGuard` and its spec are deleted once nothing uses them. `isAdminMember` becomes the root check.

## Login and identity

- `AdminAuthService` step 5, which rejects a member who holds none of the configured admin roles, is removed. Main-server membership stays required, because grants map to main-server roles and roles are synced at login.
- Sessions for members with no grants are valid and see nothing but the session-only endpoints.
- `GET /auth/admin/me` returns the profile plus `permissions` (a map of every catalog resource to its effective level) and `root` (boolean). The panel builds its navigation from this.
- The error text for a rejected admin login that mentions a configured admin role is removed or reworded.
- The inbound-webhook default reader role (`environmentDefaultReaders`) is unrelated and unchanged.

## Grant-management API (root only)

All under `/admin/access`, all `@RootOnly()`, all documented in Swagger.

| Endpoint | Purpose |
|---|---|
| `GET /admin/access/catalog` | The resources and levels with descriptions |
| `GET /admin/access/roles` | Main-server roles with their grants |
| `PUT /admin/access/roles/:roleId` | Replace a role's grants. Body: `{ grants: { <resource>: <level> } }`. Missing or `none` means no row |
| `GET /admin/access/members/:memberId` | A member's overrides |
| `PUT /admin/access/members/:memberId` | Replace a member's overrides. `none` is stored as a deny |
| `DELETE /admin/access/members/:memberId/:resource` | Remove one override, so the member falls back to their roles |
| `GET /admin/access/members/:memberId/effective` | Effective level per resource with its source: `root`, `override`, or the role id that supplied it |

Validation: unknown resources and levels return 400. Unknown roles or members return 404. Root roles are shown as root and cannot be given grants, since root already holds everything.

## Audit

- Each grant change writes an `audit_logs` row, `actionType: 'access'`, with the actor, the target (role or member), and the before and after grants in `details`. The write happens in the service, as the inbound-webhook service does, so before and after are known.
- The routes are added to `ROUTE_MAP` only if the service-level write does not already cover them, to avoid double rows.
- Permission denials are already recorded as 403 by `AuditLoggingMiddleware`.

## Rollout

1. Deploy the migration. No data is seeded.
2. Root roles keep exactly the access they have today.
3. Members outside the root roles could never sign in before. They can now, with no access until a root admin grants some.
4. Nobody loses access.
5. If no root role is configured nobody can edit grants. Production already fails to boot without `MC_EXECUTIVE_ROLE_ID`.

## Testing

- Resolver unit tests: hierarchy, highest level across several roles, an override that raises, an override that lowers, an override of `none`, root, and a member with no roles.
- Guard unit tests: 401, 403 with the right message, allow, fail closed on an undecorated handler, cache hit and Redis-down fallback.
- A route-coverage test that loads every controller using `AdminAccessGuard` and fails when a handler has no decorator. This catches an unclassified endpoint at test time.
- A snapshot test of the resource and level declared on every admin route, so reclassifying an endpoint shows up as a visible diff in review.
- Per-resource e2e: one request refused below the required level and one allowed at it, using seeded grants. Existing admin e2e suites keep working by seeding a root-role member in `test/helpers/db.ts`.
- Grant-management e2e: root can edit, a non-root member with `manage` on everything cannot, and each change writes an audit row.
- Coverage thresholds in `jest.config.cjs` stay enforced.

## Documentation

- Regenerate the API reference with `pnpm docs:api` and commit the result.
- Update the hand-written pages in `apps/web/src/content/docs` that describe admin access (the architecture and decisions pages, the integrate and build guides where they mention the three admin roles), in the same pull request.
- Document the new behavior of `MC_EXECUTIVE_ROLE_ID`, `MC_DEV_LEADS_ROLE_ID` and `MC_IT_LEADS_ROLE_ID`: they now define root, not the admin list. Tests check that every environment variable is documented.
- Add a decision record for this change to the decisions page.

## Out of scope: panel work (second spec)

- Build the navigation and page access from `permissions` in `GET /auth/admin/me`.
- A "you do not have access" page for a member with every level `none`.
- A grants screen for root: roles grid, member overrides, and an "effective access" view backed by `/effective`.

## Risks

- **Any main-server member can now obtain an admin session.** Mitigated by the fail-closed guard: a session alone reaches only the session-only endpoints. The route-coverage test is the safety net for future endpoints.
- **Cache staleness.** A role change in Discord reaches the database at the next sync event, and the permission cache adds up to its TTL on top. Grant edits invalidate the cache immediately.
- **A misconfigured root list locks everyone out of grant editing.** Production boot validation already requires the executive role.
