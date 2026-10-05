# Inbound webhooks — admin UI

**Status:** reviewed · **Date:** 2026-10-04 · **Builds on:** `docs/MCDI-INBOUND-WEBHOOKS-PRD.md`, PR #146 (merged), PR #154 (grouped sidebar)

## 1. Why

Inbound webhooks are fully usable through the API, but an admin can only create one by posting a JSON schema through Swagger or curl, and nobody can browse submissions from the admin panel. Inbound webhooks belong to a project, so managing them belongs in the panel under **Projects**, next to the project's outbound Webhooks.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Where it lives | A project sub-page: **Projects › [project] › Inbound webhooks** |
| How the schema is written | **Option B**: a JSON editor that knows the schema format (autocomplete, inline errors), starter templates, and a live preview of the generated docs. A visual builder may come later on top of the same JSON. |
| Who reads submissions | Each webhook has its own reader roles. **MC Executive is a configurable default** for new webhooks (stored like any other role, removable); the defaults are managed from the inbound webhooks settings screen. There is no admin bypass. |
| CSV export | Built in the web UI from the read API; no export endpoint. |
| Drafts / multi-step protocol (IW-07) | On hold |
| Create with a new project (IW-11) | On hold |
| Signed download URLs (IW-10) | Dropped |
| File upload (IW-08) | Separate track, not in this spec |

## 3. Scope

**In:** two API changes (§4) and four web screens (§5).
**Out:** a visual form builder, file upload, drafts, `allowRoleInheritance` (IW-17), conditions inside array items (IW-18), a reader UI for members who are not admins.

## 4. API changes

### 4.1 Default reader roles (MC Executive by default)

**Rule (revised):** executive access comes from **configuration**, not from logic in the read path. A setting holds the *default reader roles* of inbound webhooks; until it is configured it defaults to the executive role (`MC_EXECUTIVE_ROLE_ID`), the way the admin settings override env defaults.

- A webhook created **without** `allowedRoleIds` gets the defaults; when `allowedRoleIds` is sent, exactly those roles are used. The defaults are **removable** per webhook.
- They are stored as **ordinary grants**. The read guard, the member's webhook list and the stored data don't change.
- The configured default roles are exempt from the "roles must be on the project's servers" check (the executive role lives on the main server) on create and on `PUT /:id/roles`. Other roles are checked as today. Defaults that no longer exist are skipped, not an error.
- A single-row table `inbound_webhook_settings` (`default_reader_role_ids`, `NULL` = use the environment default) stores the setting, managed from the **inbound webhooks settings screen** (§5.5) through `GET` and `PUT /api/admin/inbound-webhooks/settings`. `PUT` replaces the list (may be empty), rejects unknown roles, is audited and records who changed it.
- Not retroactive: existing webhooks keep their current roles.

**Tests:** defaults applied when omitted; an explicit list wins; defaults exempt from the project-servers check but other roles aren't; an empty final set is a 400; deleted default roles are skipped; settings get/put and the environment fallback (database); `settings` is not taken for a webhook id.

### 4.2 Schema preview endpoint

The editor needs the server's verdict while the admin types, and the docs preview needs a rendered result before the webhook exists (today docs exist only for created webhooks).

```
POST /api/admin/inbound-webhooks/schema/preview      (SystemAdminGuard)
body: { "schema": { …FormSchema… }, "name": "Recruitment 2026" }

200 { "ok": false, "errors": [ { "path": "steps[0].fields[0].maxlenght", "code": "UNKNOWN_PROPERTY", "message": "…" } ] }
200 { "ok": true,  "markdown": "…", "examplePayload": { … } }
```

- Runs the same Layer-1 validator as create (`validateSchema`), so the preview and create can never disagree.
- On success, renders the docs with the existing generator (`renderMarkdown`, `buildExamplePayload`) using placeholder values for the parts that need a saved webhook (ID, URL, roles).
- Stores nothing and is not audited (it changes nothing). A 200 with `ok: false` for an invalid schema keeps "the schema is wrong" apart from "the request failed".
- Bounded like create: same body limit, schema limits (`SCHEMA_LIMITS`), and pattern tests in the docs self-check already run under the 50 ms timeout.

**Tests:** invalid schema returns every error with its path; valid schema returns Markdown and an example; nothing is written.

## 5. Web screens

All under `apps/web`, following the existing feature layout (`features/inbound-webhooks/` with `api/`, `components/`, `types/`) and the project-scoped route pattern from PR #154.

### 5.1 Sidebar

A fourth sub-item under the project switcher: **Inbound webhooks** → `/dashboard/projects/[id]/inbound-webhooks`.

### 5.2 List — `/dashboard/projects/[id]/inbound-webhooks`

- Table: name, slug, active, signature on/off, number of chosen roles (plus "MC Executive").
- **New inbound webhook** button.
- Empty state explaining what an inbound webhook is, with the same button.
- Data: `GET /api/admin/inbound-webhooks?projectId=…`.

### 5.3 Create — `/dashboard/projects/[id]/inbound-webhooks/new`

A full page rather than a dialog, because the editor needs room. Layout as in the Option B mockup:

- **Name** and **Slug** (slug suggested from the name, editable; lowercase letters, digits and dashes).
- **Schema editor** with, from the top:
  - **Start from template**: Recruitment, Workshop sign-up, Event registration, Blank. Picking one when the editor has content asks to confirm.
  - **Autocomplete** for property names and field types, each with a one-line description.
  - **Inline errors**:
    - *Instant* (as you type): JSON syntax, and the format rules the client knows (unknown property, wrong value type, missing required property), from a JSON Schema description of the form-schema format.
    - *Authoritative* (600 ms after typing stops): the preview endpoint's errors, mapped from their path (`steps[1].fields[0].condition.field`) to the line in the editor. These include the rules only the server knows: unknown condition references, forward references, invalid regex patterns, date bounds.
  - **Problems list** under the editor: each error with its path, message and line; clicking one moves the cursor there.
- **Preview pane** beside the editor: the Markdown the preview endpoint returns, plus the example payload. While the schema is invalid it keeps the last valid preview, greyed, with "Fix the problems to update the preview".
- **Who can read submissions**: a role picker limited to roles on servers the project can access (`GET /api/admin/projects/access/matrix?projectId=…` gives the servers; their roles come from the existing roles data). The configured default roles (MC Executive) come pre-selected and can be removed. At least one role is required.
- **Options**: accepted origins (list of URLs; empty = any), require signature (default on), reject unknown fields (default on).
- **Warning** while file upload doesn't exist: a schema with a required `file` or `files` field shows "Submissions can't include files yet, so this field will reject every submission".
- **Create**: `POST /api/admin/inbound-webhooks`. On success, the **signing secret is shown once** in a dialog (copy button, "it won't be shown again"), following the existing API-key reveal; closing it opens the webhook's page.

### 5.4 The webhook's page — `/dashboard/projects/[id]/inbound-webhooks/[webhookId]`

Sections, top to bottom:

1. **Header**: name, slug, active switch (`PATCH { isActive }`).
2. **Settings**: name, origins, signature, unknown fields — edit and save (`PATCH /:id`).
3. **Schema**: the same editor in read mode with an **Edit** button. Saving sends `PATCH { schema }`; the preview endpoint checks it first. Editing stays available once the webhook has submissions — a form in use must still be changeable. In that case the save asks to confirm: "Existing submissions are not re-checked; new submissions must match the new schema".
4. **Who can read**: the same picker; saving sends `PUT /:id/roles`.
5. **Signing secret**: **Rotate** → confirm ("the project must switch to the new secret at once; old signatures stop working") → `POST /:id/rotate-secret` → shown once.
6. **Developer docs**: the Markdown from `GET /:id/docs`, with **Download Markdown** and **Download OpenAPI** (`?format=openapi&download=true`).
7. **Submissions** (tab or section):
   - Table from `GET /api/inbound-webhooks/:id/submissions` (the role-gated read API, using the admin's session): received at, then by default the first three answers in schema order (`step.field`); a **Columns** menu lets the admin pick any fields instead, remembered per webhook in this browser. Opening a row shows the full payload (`GET /:id/submissions/:submissionId`).
   - Date filters (`dateFrom`, `dateTo`) and paging (the API returns at most 200 per page).
   - **Export CSV**: pages through every submission matching the filters, flattens each payload to one column per `step.field` (lists and objects JSON-encoded in their cell), adds `id` and `receivedAt`, and downloads the file. Shows progress for large exports.
   - A member who can't read the webhook gets the API's 404; the tab then says "You don't hold a role that can read this webhook's submissions". With §4.1, an MC Executive admin always can.
8. **Delete**: destructive confirmation → `DELETE /:id`.

### 5.5 Inbound webhooks settings — `/dashboard/projects/[id]/inbound-webhooks/settings`

The default reader roles of §4.1: a role picker over every role of every server (they apply to all projects), pre-filled with the current default, saved with `PUT /api/admin/inbound-webhooks/settings`. It shows whether the value comes from the stored setting or the environment, and explains that changing it affects **new** webhooks only.

## 6. Editor implementation

- **CodeMirror 6** (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-json`, `@codemirror/lint`, `@codemirror/autocomplete`) plus **`codemirror-json-schema`** for autocomplete and checking from a JSON Schema. Monaco was rejected for size (~2 MB). Loaded only on the create and webhook pages (dynamic import), so the rest of the panel doesn't pay for it.
- **`react-markdown`** to render the docs preview and the docs section (raw HTML disabled, which is its default).
- **The JSON Schema of the form-schema format** is written by hand in `features/inbound-webhooks/schema/`, mirroring `form-schema.types.ts` and the constraint table in `schema.validator.ts`.
  - **Drift risk:** the JSON Schema can fall behind the API. The server check (§4.2) is the source of truth, so drift only weakens the instant hints, never correctness.
  - **Guard:** a web test checks every starter template against the JSON Schema, and an API test checks the same templates against `validateSchema`. A template valid on one side and not the other fails a test.
- **Templates** live as JSON files next to the JSON Schema.

## 7. Delivery

| PR | Contents | Depends on |
|---|---|---|
| 1 | API: MC Executive always reads (§4.1) | — |
| 2 | API: schema preview endpoint (§4.2) | — |
| 3 | Web: sidebar item, list, create page with the editor (§5.1–5.3, §6) | 2 |
| 4 | Web: the webhook's page, including submissions and CSV export (§5.4) | 1, 3 |

Each PR: tests first, full suites, lint, typecheck, build; feature PRs target `dev`.

## 8. Review decisions

1. **Default reader roles** — configurable from the inbound webhooks settings screen, stored like any grant and removable per webhook (revised from the earlier `fixed` flag).
2. **Schema edits** — always allowed, including once submissions exist (with the confirmation in §5.4).
3. **Submissions columns** — first three answers by default; the admin can choose others.
4. **Readers without an admin role** — out of scope: this dashboard is for admins only.
