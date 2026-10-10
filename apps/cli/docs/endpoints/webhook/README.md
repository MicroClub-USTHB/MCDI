# Webhook — MCDI endpoints

`mcdi-cli webhook ...` targets MCDI's **Inbound Webhooks** admin API —
`/admin/inbound-webhooks`. This is a different feature from MCDI's existing
(outbound) Discord-channel `webhooks` module
(`servers/:serverId/channels/:channelId/webhooks`, project-API-key scoped,
used to post *into* Discord). Don't confuse the two when reading MCDI's
source — mcdi-cli never touches the Discord-channel webhooks surface.

## Status: merged, live on `main`

The admin inbound-webhooks controller
(`apps/api/src/modules/inbound-webhooks/inbound-webhooks.controller.ts`) is
merged into MCDI's `main` and deployed to prod. PRD §13 "D1" is resolved —
everything below is current against `main`, not a feature branch.

All routes are under `/admin/inbound-webhooks`, guarded by MCDI's
`SystemAdminGuard` (Bearer session token from the [login flow](../login/)).

## `POST /admin/inbound-webhooks` — create

Request body (`CreateInboundWebhookDto`):

```ts
{
  projectId: string;          // required
  name: string;                // required, 1-255 chars
  slug: string;                 // required, ^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$, unique per project
  schema: FormSchema;           // required — see mcdi-cli-PRD.md §8
  allowedRoleIds?: string[];    // optional, each a Discord snowflake (\d{17,20}); omitted → project default reader roles
  acceptedOrigins?: string[];   // optional, empty = no origin check
  requireSignature?: boolean;   // optional, default true
  rejectUnknownFields?: boolean;// optional, default true
  allowRoleInheritance?: boolean;// optional, default false
}
```

- `201` on success — **includes the signing secret, returned exactly once.**
  mcdi-cli must surface/store it the same way it handles `rotate-secret`
  (§12.2 of the PRD) — never persisted to the config file or logs. The
  response's `allowedRoleIds` reflects what was actually applied, including
  the fallback when the request omitted it.
- `400` invalid schema, or unknown/foreign roles.
- `409` slug already used within the project.
- `allowedRoleIds` is optional: when omitted, MCDI applies the project's
  configured default reader roles (MC Executive unless changed); when
  given, exactly those roles are used. Either way at least one role must
  result — unlike `project_roles`, an empty set here would mean nobody (not
  everybody), so the API still fails closed against an empty array.

Maps to `mcdi-cli webhook create <schema-path> --name <name> --project <project-id> [--roles <roleId>[,<roleId>...]] [--accept-origin <origin>]...`
(`--roles` omitted → the project's default reader roles).

## `GET /admin/inbound-webhooks` — list

Query: `?projectId=<id>` (optional — omit to list across all projects).

`200` — webhooks, newest first. Maps to `mcdi-cli webhook list [--project <project-id>]`.

## `GET /admin/inbound-webhooks/:id` — get one

`200` with the webhook, `404` if it doesn't exist. Maps to
`mcdi-cli webhook get <id> [--schema-only] [--json]` (the `--schema-only`
projection is a client-side concern — the endpoint returns the full record).

## `GET /admin/inbound-webhooks/:id/docs` — export integration docs

Query:
- `format` — `markdown` (default) or `openapi`
- `download` — `"true"` to receive it as a file attachment
  (`Content-Disposition: attachment`)

Generated live from the webhook's current schema (so it can't drift from
what the validator enforces): a Markdown integration guide (endpoint, auth,
signing code in JS and Python, every field with constraints, an example
payload, the error table, who may read submissions) or an importable OpenAPI
3.1 spec. Not in the PRD's command surface (§7) as a dedicated subcommand —
worth a follow-up decision on whether `webhook get --docs` (or similar)
should expose it, since it's a nice fit for `schema init --template` style
workflows.

## `PATCH /admin/inbound-webhooks/:id` — update

Request body (`UpdateInboundWebhookDto`) — all fields optional, only send
what's changing: `name`, `schema` (re-validated on update), `acceptedOrigins`,
`requireSignature`, `rejectUnknownFields`, `allowRoleInheritance`, `isActive`.

`200` on success, `400` on invalid schema. Maps to
`mcdi-cli webhook update <id> [--schema <path>] [--name <name>] [--active|--inactive]`
(`--active`/`--inactive` map to `isActive: true/false`).

## `GET /admin/inbound-webhooks/:id/roles` — list allowed readers

`200` with the current `allowedRoleIds`. Not an explicit PRD command, but
useful groundwork for `webhook roles set` to show the current state first.

## `PUT /admin/inbound-webhooks/:id/roles` — replace allowed readers

Request body (`SetAllowedRolesDto`): `{ roleIds: string[] }` — required,
non-empty, each a Discord snowflake.

`200` with `{ roleIds: string[] }`. `400` if the set is empty or contains
unknown/foreign roles — **the set can never be emptied**, since removing the
last role is effectively deleting the webhook's readability, not editing it.
Maps to `mcdi-cli webhook roles set <id> --roles <roleId>[,<roleId>...]`.

## `POST /admin/inbound-webhooks/:id/rotate-secret` — rotate signing secret

`200` with `{ signingSecret: string }` — **MCDI returns it exactly once and
never re-issues it.** It's stored server-side as a hash, same as session
tokens, so there's no "show it to me again" endpoint — a later `GET
/admin/inbound-webhooks/:id` will not include the plaintext secret. Maps to
`mcdi-cli webhook rotate-secret <id>`.

Because the server never re-exposes it, **mcdi-cli is the only place that can
answer "what's the secret for webhook X?" after creation.** Current design
decision: mcdi-cli persists it locally, encrypted at rest using the same
mechanism as the session token (PRD §12.1 — OS keychain, falling back to
`~/.mcdi-cli/key`), and exposes it again via `mcdi-cli webhook secret get`
(see issue tracking this). This is a deliberate departure from the PRD's
original §12.2 ("never persisted anywhere, shown once") — update §12.2 in
the MCDI-side PRD copy if this design sticks, so the two docs don't drift.

## `DELETE /admin/inbound-webhooks/:id` — delete

`204 No Content` — deletes the webhook **and all its submissions**. No
undo. Maps to `mcdi-cli webhook delete <id> [--yes]` — `--yes` must be a
client-side confirmation gate; the API itself does not ask for confirmation
or support a dry run.

## Not yet an endpoint: `webhook diff`

`mcdi-cli webhook diff <id> <schema-path>` (PRD §7) is a client-side diff
between a local schema file and `GET /admin/inbound-webhooks/:id`'s live
`schema` — there's no server-side diff endpoint, and none is needed; `GET`
+ local pre-check (already required for `diff` anyway, per PRD §9) is
sufficient.

## Gaps for mcdi-cli

1. Confirm whether `GET /:id/docs` should be wired into any mcdi-cli command,
   or left purely for direct browser/API use — not currently in the PRD's
   command surface (§7).
