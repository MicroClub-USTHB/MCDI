# Admin panel: permission-aware UI and the Access screen

Status: design agreed in brainstorming, awaiting spec review.
Scope: the web admin panel (`apps/web`), the shared contracts package, and one small API endpoint.
Builds on: `docs/superpowers/specs/2026-10-07-admin-permissions-design.md`, PRs #197 to #200.

## Problem

The API now decides what an admin may do by a level (`none`, `read`, `write`, `manage`) per resource, and `GET /api/auth/admin/me` returns the member's `root` flag and effective level per resource. The panel still assumes "signed in" means "admin":

- It ignores `root` and `permissions`. The auth store, `AdminProfileDto` and `User` do not carry them.
- The sidebar is a fixed list. Every page and every button is shown to everyone.
- A member who holds no grant can now sign in (the API no longer requires an admin role at login). They land in a panel where every call answers 403, and the panel has no "no access" state.
- Root has no way to grant levels except Swagger or curl.

## Goals

- The panel shows only what the signed-in member can use: sidebar links, pages, sections of mixed pages and buttons.
- A member with no access, or who opens a URL they may not use, sees a clear explanation instead of failing requests.
- Root manages role grants and per-person overrides from the panel.
- One definition of the resources and levels, shared by the API and the panel.

## Non-goals

- The panel never enforces anything. The API stays the only enforcement, and the panel adapts to it. The session cookie belongs to the API origin, so Next cannot read it, and `proxy.ts` keeps checking only the `auth-token` presence flag.
- No change to how inbound webhook submissions are read. Reading them is governed by the webhook's reader roles, with no admin bypass, and is not affected by levels.
- No change to the login or logout flows, or to project API-key endpoints.
- No read-only "matrix overview" of roles by resources, and no impact counts ("N members hold this role"). Both are follow-ups.
- Moving root roles into the database is a separate API follow-up and does not change this design: the panel only reads `root` from `/me`.

## Decisions taken

| Question                         | Decision                                                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                            | Both the permission-aware panel and the Access screen, as one spec delivered in three PRs                                                                                                                                         |
| Depth of gating                  | Sidebar, pages and actions                                                                                                                                                                                                        |
| Rule approach                    | Central rules (a route table, `useCan`, `<Can>`), with the resource and level catalog moved into `@mcdi/contracts`                                                                                                                |
| Where overrides are managed      | A root-only Access page per member (`/dashboard/members/[discordId]/access`), linked from the member page, and opened in place from the Members tab of the Access screen (one new API endpoint marks who already has an override) |
| Role editor layout               | A role list and a one-role editor, with one Save per role                                                                                                                                                                         |
| Buttons below the member's level | Hidden, not disabled. A readable form that cannot be changed is shown read-only                                                                                                                                                   |
| Unmapped dashboard routes        | Denied by default, like the API                                                                                                                                                                                                   |

## Part 1: the permission-aware panel (PRs 1 and 2)

### What the panel knows

`GET /api/auth/admin/me` already returns:

```
{ ...profile, root: boolean, permissions: Record<AccessResource, AccessLevel> }
```

- `AdminProfileDto` gains `root` and `permissions`. The mapper and the `User` type carry them, and the Zustand store persists them with the user as it does today.
- `SessionProvider` revalidates `/me` on mount, so a persisted value never outlives the first render for long. The `useCurrentAdminQuery` cache changes from 5 minutes to 1 minute and refetches on window focus. When an API call answers 403, the client invalidates the `/me` query, so a revoked level disappears from the UI at once, and the rest of the panel re-evaluates.
- The 403 handling must not loop: one invalidation per refused call, and the existing toast with the API's message still shows. The mechanism (a registered `onForbidden` handler on the API client set by the query provider) is left to the plan.

### One catalog, shared

`packages/contracts/src/access.ts` is added and exported from `index.ts`:

- `ACCESS_RESOURCES`, `AccessResource`, `ACCESS_LEVELS`, `AccessLevel`, `GRANT_LEVELS`, `GrantLevel`
- `levelAtLeast(effective, required)`, `isAccessResource`, `isAccessLevel`, `isGrantLevel`

`apps/api/src/common/permissions/catalog.ts` imports these from `@mcdi/contracts` and re-exports them, and keeps `RESOURCE_DESCRIPTIONS` and `LEVEL_DESCRIPTIONS`, which `GET /admin/access/catalog` serves to the panel. The contracts package stays dependency-free and compiled, as `CLAUDE.md` requires.

The panel keeps friendly titles for the resources (for example `project_keys` is "Project API keys") in the `access` feature, and takes the descriptions from the catalog endpoint.

### The rules

`apps/web/src/shared/lib/route-access.ts` holds a `Requirement` type and the route table:

```
Requirement =
  | { kind: 'open' }                                  // any signed-in admin
  | { kind: 'anyAccess' }                             // at least one resource above none
  | { kind: 'permission'; resource; level }
  | { kind: 'root' }
  | { kind: 'all'; of: Requirement[] }
  | { kind: 'any'; of: Requirement[] }
```

- `canAccess(user, requirement)` evaluates a requirement. Root passes everything, because its `permissions` are `manage` throughout.
- `useCan(resource, level)` and `<Can resource level fallback>` gate buttons and sections.
- `requirementForPath(pathname)` matches a route pattern, most specific first.
- Page guard: `dashboard/layout.tsx` wraps its children in a `RequireAccess` that evaluates the matched requirement. A route with **no entry is denied**. A test fails if any `page.tsx` under `app/dashboard` has no entry in the table.

### Route table

Opening a page needs `read`. The actions on a page need more, and are listed below the table.

| Route                                                          | Requirement                                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                                   | `anyAccess`. Each card needs its own resource, see "Mixed pages"                                                                         |
| `/dashboard/members`, `/dashboard/members/[discordId]`         | `members:read`                                                                                                                           |
| `/dashboard/members/[discordId]/access` (new, PR 3)            | `root`                                                                                                                                   |
| `/dashboard/stats`                                             | `stats:read`                                                                                                                             |
| `/dashboard/servers`, `/dashboard/servers/[id]`                | `servers:read`                                                                                                                           |
| `/dashboard/servers/[id]/members`                              | all of `servers:read`, `members:read`                                                                                                    |
| `/dashboard/servers/[id]/roles`, `.../roles/[roleId]`          | all of `servers:read`, `roles:read`, `stats:read`. The role list is built from `/admin/stats/roles`, so statistics are primary data here |
| `/dashboard/servers/[id]/channels`                             | all of `servers:read`, `channels:read`                                                                                                   |
| `/dashboard/servers/[id]/sync`, `.../sync/logs/[syncLogId]`    | all of `servers:read`, `sync:read`                                                                                                       |
| `/dashboard/roles` (redirects into a server)                   | all of `servers:read`, `roles:read`, `stats:read`                                                                                        |
| `/dashboard/channels` (redirects into a server)                | all of `servers:read`, `channels:read`                                                                                                   |
| `/dashboard/sync`, `/dashboard/sync/logs/[syncLogId]`          | all of `servers:read`, `sync:read`                                                                                                       |
| `/dashboard/projects`, `/dashboard/projects/[id]`              | `projects:read`. The API key panel on the project page needs `project_keys:read`                                                         |
| `/dashboard/projects/[id]/access`                              | all of `projects:read`, `servers:read` (the server list is how access is granted)                                                        |
| `/dashboard/projects/[id]/webhooks`                            | all of `projects:read`, `webhooks:read`                                                                                                  |
| `/dashboard/projects/[id]/inbound-webhooks`, `.../[webhookId]` | all of `projects:read`, `inbound_webhooks:read`                                                                                          |
| `/dashboard/projects/[id]/inbound-webhooks/new`                | all of `projects:read`, `inbound_webhooks:write`                                                                                         |
| `/dashboard/webhooks` (redirects into a project)               | all of `projects:read`, `webhooks:read`                                                                                                  |
| `/dashboard/monitoring`                                        | any of `monitoring:read`, `audit:read`. Sections are gated, see below                                                                    |
| `/dashboard/settings`                                          | `open`. The profile section is always available, every other section follows the rules in "The settings page"                            |
| `/dashboard/settings/inbound-webhooks`                         | `inbound_webhooks:read`. Changing the default readers needs more, see "Secondary data"                                                   |
| `/dashboard/access` (new, PR 3)                                | `root`                                                                                                                                   |

### Actions

An action is shown only when the member's level on its resource reaches the level below. Levels are cumulative, so `manage` also satisfies `write` and `read`.

| Area              | Action                                                           | Needs                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Servers           | Add, edit, enable, disable                                       | `servers:write`                                                                                                                                                                   |
| Servers           | Delete                                                           | `servers:manage`                                                                                                                                                                  |
| Roles             | Add a role permission, create or update an inheritance rule      | `roles:write`                                                                                                                                                                     |
| Roles             | Remove a role permission                                         | `roles:manage`                                                                                                                                                                    |
| Roles             | Impact preview (read-only)                                       | `roles:read`                                                                                                                                                                      |
| Projects          | Create, edit, set the redirect URI, grant server access          | `projects:write`                                                                                                                                                                  |
| Projects          | Delete a project, revoke server access                           | `projects:manage`                                                                                                                                                                 |
| Project API key   | View the key prefix and metadata                                 | `project_keys:read`                                                                                                                                                               |
| Project API key   | Regenerate, restore                                              | `project_keys:write`                                                                                                                                                              |
| Project API key   | Revoke                                                           | `project_keys:manage`                                                                                                                                                             |
| Outbound webhooks | Delete                                                           | `webhooks:manage`                                                                                                                                                                 |
| Inbound webhooks  | Create, edit, set reader roles, rotate the secret, save settings | `inbound_webhooks:write`                                                                                                                                                          |
| Inbound webhooks  | Delete                                                           | `inbound_webhooks:manage`                                                                                                                                                         |
| Sync              | Trigger a full sync, including "Sync all" on the Servers page    | `sync:write`                                                                                                                                                                      |
| Settings          | Save                                                             | `settings:write`                                                                                                                                                                  |
| Settings          | Reset to defaults                                                | `settings:manage`                                                                                                                                                                 |
| Profile           | Edit your own profile                                            | always                                                                                                                                                                            |
| Messages          | Message history inside the channels page                         | `messages:read` (the tab is omitted without it)                                                                                                                                   |
| Projects          | Create or edit a project with its server choice                  | `projects:write`, and `servers:read` for the form's server list (the field is omitted without it)                                                                                 |
| Inbound webhooks  | Change the default readers (settings sub-page)                   | `inbound_webhooks:write`, and `servers:read` plus `stats:read` for the role picker, which lists every role of every server. Without those the current readers are shown read-only |

A form the member can read but not change is rendered read-only with a "Read only" badge. For example, the settings form for a member with `settings:read`.

### Secondary data and mixed pages

The panel audit (every hook of every page and component against the endpoint it calls) found data that pages pull from other resources. Two cases, one rule for each:

- **Primary data** is what the page is made of. The page needs it, and the route table says so with `all of`.
- **Secondary data** feeds a filter, a picker, a label or an extra card. Without access to it the page still opens and that part degrades: the control or card is omitted, and names fall back to ids. The page never shows an error card for a resource the member was never allowed to read, and a query the member cannot make is not sent (`enabled` is false).

| Page                                 | Primary (opens the page)                   | Secondary (degrades without)                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard home                       | `anyAccess`                                | Servers card `servers:read`, Projects card `projects:read`, Members card `stats:read`, Sync card `sync:read`. When no card applies the page points at the sidebar                                                                 |
| Members list                         | `members:read`                             | Server filter needs `servers:read`, role filter needs `stats:read`                                                                                                                                                                |
| Server overview                      | `servers:read`                             | The statistics card needs `stats:read`                                                                                                                                                                                            |
| Servers list                         | `servers:read`                             | The sync status column needs `sync:read`, "Sync all" needs `sync:write`                                                                                                                                                           |
| Roles list and role page             | `servers:read`, `roles:read`, `stats:read` | Add, remove and rule actions as in the actions table                                                                                                                                                                              |
| Project page                         | `projects:read`                            | The API key panel needs `project_keys:read`                                                                                                                                                                                       |
| Project access                       | `projects:read`, `servers:read`            |                                                                                                                                                                                                                                   |
| Inbound webhooks (list, detail, new) | `projects:read`, `inbound_webhooks:read`   |                                                                                                                                                                                                                                   |
| Default readers (settings sub-page)  | `inbound_webhooks:read`                    | The role picker needs `servers:read` and `stats:read`, plus `inbound_webhooks:write` to save                                                                                                                                      |
| Stats                                | `stats:read`                               | The server filter needs `servers:read`                                                                                                                                                                                            |
| Monitoring                           | any of `monitoring:read`, `audit:read`     | Health, usage and failures need `monitoring:read`. The audit log needs `audit:read`. The project filter needs `projects:read`. Actor names and the actor filter in the audit log need `members:read`, otherwise the ids are shown |

### The settings page

`/dashboard/settings` is open to every signed-in admin, because it holds the member's own profile. Everything else on it follows the permission system, section by section:

| Part of the page                                                                      | Needs                                                                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Profile card (view and save)                                                          | Always available. It loads and fails independently of the rest                                                      |
| Discord configuration (read-only display), cache, rate limit and preferences sections | `settings:read`. The query is not sent without it                                                                   |
| Saving those sections                                                                 | `settings:write`. With only `settings:read` the forms are read-only with a "Read only" badge and no Save button     |
| "Reset to defaults" button and its confirmation                                       | `settings:manage`                                                                                                   |
| "Last changed" line in the header                                                     | `settings:read`, because the data comes from the same endpoint                                                      |
| Header description                                                                    | "Configure MCDI behavior and manage your admin profile." with `settings:read`, "Manage your admin profile." without |
| Link to the inbound webhook settings (on the inbound webhooks page)                   | `inbound_webhooks:read`. The sub-page is gated as above                                                             |

Today one loading and one error state cover the profile and the system settings together, so a member who cannot read settings would be stuck on skeletons or see "Settings could not be loaded". The page is restructured so each part has its own loading, error and empty state. A member with no `settings:read` simply sees the profile card, and the page does not mention what it hides.

### Sidebar

A link is visible when the requirement of its target route is met. A context group (Discord for servers, Projects for projects) is visible when its list page is allowed, and each sub-item when its own page is. A group with no visible item disappears. A member with no access at all still sees Settings, which holds their profile.

This means browsing anything under a server needs `servers:read`, because the server switcher is fed by it. The same holds for projects. A member who holds `channels:read` without `servers:read` has a grant the panel cannot reach, and so does one who holds `roles:read` without `stats:read`. The Access screen warns about this (Part 2).

### No-access states

- **No access at all:** `/dashboard` shows a "No access yet" page that names the signed-in member and says to ask an admin to grant access.
- **A forbidden URL:** an in-shell page, with the sidebar visible, that names the resource and level the page needs and links to the first page the member can use.
- The callback screen is unchanged: it keeps handling a member who is not in the main server. A member with no grant now reaches the panel and sees the no-access page.

### Tests (PRs 1 and 2)

- The route table covers every `page.tsx` under `app/dashboard` (test walks the filesystem) and every requirement is well formed.
- `canAccess` and `requirementForPath` unit tests: root, cumulative levels, `all`, `any`, `anyAccess`, `open`, most specific match, unmapped route denied.
- `useCan` and `<Can>` component tests.
- Sidebar tests: links and groups per member, including a member with only Settings.
- Per-feature tests that a read-only member sees no write or manage action and a form shown read-only, and that a manager sees them.
- Degradation tests for the secondary-data table: for example a member with only `members:read` sees the members list without the server and role filters and no request is sent to `/servers` or `/admin/stats/roles`; monitoring without `members:read` shows actor ids.
- Settings page tests: a member with no `settings:read` sees only the profile and the settings query is never sent; `settings:read` shows read-only forms; `settings:write` shows Save; `settings:manage` shows Reset; a failing profile does not hide the settings and the reverse.
- A 403 from the API invalidates the `/me` query once.
- MSW fixtures for `/auth/admin/me` gain `root` and `permissions`.

## Part 2: the Access screen (PR 3)

### Where it lives

`/dashboard/access`, root only, in the sidebar's System group, and a root-only **Access page for one member** at `/dashboard/members/[discordId]/access`. The member page links to it (a link visible to root only), and the Access screen's Members tab opens the same editor in place. Both are entries in the route table.

The member's Access view is its own page and not a tab on the member page, because the member page cannot load today: it calls `GET /api/admin/members/:discordId`, which the API does not have (only `.../servers`, the list, `cross-server` and `export` exist), and its permissions panel calls an API-key-only endpoint. Fixing that page is separate work, tracked on its own, and the Access page does not depend on it.

### Roles tab

Lists the main server's roles in Discord order from `GET /admin/access/roles`. Layout: the role list on the left, the selected role's editor on the right.

- Root roles show a lock badge and a note that their full access comes from the API configuration. They cannot be edited.
- Any other role opens an editor with one row per resource: the title, the catalog description, and a segmented control `none`, `read`, `write`, `manage`. It is a radio group with a visible label and keyboard support.
- **Save** sends one `PUT /admin/access/roles/:roleId` with the full set of grants (`none` rows are left out). **Discard** resets the form. The editor tracks unsaved changes.
- On a narrow screen the list and editor stack, with the list first.

### Member Access page

The page shows the member's name and avatar and a table: resource, the member's effective level, its source (`Root`, `Role: <name>`, `Override`, or none), and an override control with **Inherit**, `none`, `read`, `write`, `manage`. It reads `GET /admin/access/members/:memberId/effective` and `GET .../members/:memberId`. So that the page needs nothing from the member endpoints, the `effective` response gains the member's `username`, `displayName` and `avatar` (a small API addition, in the same PR as the overrides endpoint).

- **Save** sends `PUT /admin/access/members/:memberId` with the full override set. Inherit leaves a resource out, because the API replaces the set.
- A member who currently holds a root role shows "Full access, cannot be changed" and no controls. The API refuses overrides on them.
- A member id the API does not know shows a not-found state (the API answers 404).

### Members tab

A master-detail view: on the left, every member of the server (avatar, name and username) in a list with a search box and page controls (the paginated `GET /api/admin/members` list, filtered by `search`/`page`/`limit`), with members who already carry an override marked. Selecting a member on the left opens the member editor from the section above on the right, so root can see and change one person's access without leaving the screen; nothing selected shows a prompt to pick someone. The same editor still backs the member's Access page at `/dashboard/members/[discordId]/access`.

**Endpoint used for the marks:** `GET /api/admin/access/overrides`, root only.

```
{ "members": [
    { "memberId": "...", "username": "...", "displayName": "...", "avatar": null,
      "root": false, "overrides": { "messages": "none", "projects": "manage" } }
] }
```

- Ordered by display name, then member id. No pagination: the list is bounded by the club's size. That is the known ceiling, and paging is the upgrade.
- It follows the existing pattern: a repository query joining `admin_member_access` and `members`, a method on `AdminAccessGrantsService`, a controller method with `@RootOnly()` and Swagger, an entry in `admin-access-coverage.spec.ts`, an e2e test and a regenerated API reference.

### Safety

- **Confirm before lowering.** A save that lowers or removes any level asks first (for example "Members with this role lose this access immediately"), using the existing `confirm-dialog`. Raising a level needs no confirmation.
- **Prerequisite hints.** An editor shows a warning when a grant cannot be reached in the panel for lack of a prerequisite, for example "Channels needs Servers: read to be reachable in the panel". The hints come from the `all of` rules of the route table, plus one explicit entry for `messages`, which is a tab inside the channels page. A test keeps the hints in step with the table.
- **Errors.** The API's 400 and 404 messages show as toasts, and the editor keeps the unsaved form.
- **Audit.** Changes are already `access` rows in the audit log. `access` is added to the audit section's action-type filter (`AuditActionType` and `AuditLogFilters`), so root can see them.

### Data

React Query keys under an `access` feature: catalog (static), roles, a member's overrides, a member's effective access, and the overrides list. Saves invalidate the affected keys. Saving a role or a member does not change root's own access, so it does not refetch `/me`.

### Tests (PR 3)

- API: unit tests for the new service method and controller, the coverage entry, and an e2e test (root sees a seeded override, a non-root member gets 403, a root member is flagged).
- Web: the role editor (renders per resource, dirty state, Save sends the full set without `none`, Discard, root role locked), the member Access page (sources, Inherit leaves a resource out, root member locked, unknown member), the member picker (list, search, paging, override marks, selection drives the editor), the confirm dialog on lowering, the prerequisite hint, and that none of it renders for a non-root member.

## Delivery

| PR               | Branch                             | Contents                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundations   | `benabdou/admin-panel-foundations` | The spec and the three plans, the contracts catalog and API re-export, `/me` data in the store, the rules library, `useCan` and `<Can>`, the route table, the page guard and no-access states, the sidebar, the 403 refresh, test helpers |
| 2. Gating        | `benabdou/admin-panel-gating`      | Every query hook gated, secondary data degrading, every write and manage action gated across the features, the settings page restructured, docs                                                                                           |
| 3. Access screen | `benabdou/admin-panel-access`      | The overrides endpoint and the extended `effective` response, the Access screen and the member Access page, safety features, audit filter, tests, docs                                                                                    |

PR 2 and PR 3 both build on PR 1 and do not depend on each other. Each starts from the latest `dev` after PR 1 has merged. The plans live in `docs/superpowers/plans`: `2026-10-07-admin-panel-foundations.md`, `2026-10-07-admin-panel-gating.md` and `2026-10-07-admin-panel-access-screen.md`.

## Documentation

- The web guide pages that describe the sidebar and access (`apps/web/src/content/docs/build/web-guide.mdx`) are updated in PR 2, and the Access screen in PR 3. The tests check that excerpts match their files.
- The API reference is regenerated in PR 3 for the new endpoint.
- `apps/web/CLAUDE.md` and `AGENTS.md` gain a short rule: a new dashboard page needs a route-table entry, and a new write or manage action needs `useCan` or `<Can>`.

## Risks

- **PR 2 touches many features.** Mitigated by the route-table coverage test and per-feature tests, and by keeping each action change to a single `useCan` or `<Can>` wrap.
- **The UI can be briefly out of date.** A grant change reaches an open panel within about a minute, or immediately when the member tries a refused action. The API is always right, so the worst case is a visible button that answers 403.
- **A grant can be unreachable in the panel** (for example `channels` without `servers`). The prerequisite hints reduce it; the API still allows the grant, so API clients are unaffected.
- **The overrides endpoint has no pagination.** It only marks who has overrides now (the picker pages the members list); fine for the club's size, add paging if it ever grows.

## Follow-ups

- The member detail page (`/dashboard/members/[discordId]`) does not work against the real API: it calls `GET /api/admin/members/:discordId`, which does not exist, and its permissions panel calls the API-key-only `GET /permissions/:serverId/:discordId`. Tracked as its own issue; the Access page does not depend on it.
- A read-only matrix overview of roles by resources.
- Impact counts ("N members hold this role") before saving a lowering change.
- Root roles in the database (the API follow-up described in the permissions spec). The panel is unaffected, because it reads only `root`.
- Issues #193 to #196 are independent of this work.
