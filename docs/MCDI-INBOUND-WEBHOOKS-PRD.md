# MCDI — Inbound Webhooks
## Product Requirements Document

> **Status**: Draft — Ready for GitHub Issue Creation
> **Focus**: Typed inbound ingest endpoints with multi-step schemas, file uploads, and Discord-role-gated submission access
> **Target Audience**: Development Team (Backend)
> **Depends on**: existing `projects`, `permissions`, `audit`, `sync` modules

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Terminology — Why "Inbound"](#2-terminology--why-inbound)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [User Stories](#4-user-stories)
5. [Architecture](#5-architecture)
6. [Schema Definition Language](#6-schema-definition-language)
7. [Data Model](#7-data-model)
8. [API Surface](#8-api-surface)
9. [Security Model](#9-security-model)
10. [Role-Gated Read Access](#10-role-gated-read-access)
11. [File Handling](#11-file-handling)
12. [Environment Variables](#12-environment-variables)
13. [Error Response Standard](#13-error-response-standard)
14. [Testing Strategy](#14-testing-strategy)
15. [Open Decisions](#15-open-decisions)
16. [Issue Breakdown](#16-issue-breakdown)
17. [Dependency Graph](#17-dependency-graph)

---

## 1. Executive Summary

### 1.1 Problem

MCDI has no way for an external MicroClub application to submit structured data
into the platform. Today a club project that runs a registration form, a workshop
sign-up, or a recruitment flow must build and host its own backend, its own
validation, and its own access control — then separately ask MCDI who is allowed
to read the results.

### 1.2 Solution

**Inbound Webhooks**: MCDI-owned HTTP endpoints that accept structured submissions
from an authenticated project, validate them against a schema the project declared
up front, persist them, and expose the results **only** to Discord members holding
one of an explicitly declared set of roles.

In one sentence: *a schema-validated form backend, with Discord roles as the
authorization layer.*

### 1.3 Why MCDI is the right home

MCDI already owns the two things this needs and nobody else has: the API-key
identity of every MicroClub project (`projects`, `ApiKeyGuard`), and a live,
synced picture of who holds which Discord role (`server_member_roles`, `sync`
module). Building this anywhere else means duplicating both.

### 1.4 Current state of the word "webhook" in this codebase

Three unrelated things already carry the name. This feature deliberately does not
reuse it:

| Existing | Meaning | Status |
|---|---|---|
| `DiscordService.getWebhooks` / `createWebhook` | Discord-owned webhook URLs; MCDI is the client posting into a channel | wrapper exists, no controller calls it |
| `project.webhookUrl` | Outbound — the project's URL, for MCDI to POST events to | column exists, never read by any caller |
| `MANAGE_WEBHOOKS` | Two distinct permissions sharing a name: Discord's bit `536870912n`, and the `project_servers` operation flag | both in use |

---

## 2. Terminology — Why "Inbound"

A webhook's direction is defined by **which party opens the HTTP connection**.

**Outbound** (`project.webhookUrl`, today): MCDI is the *client*. An event happens
inside MCDI and MCDI calls out to an address the project registered.

```
Discord event ──▶ MCDI ──POST──▶ https://client-app.com/hooks/mcdi
```

**Inbound** (this feature): MCDI is the *server*. It does not store anybody's
address — it **is** the address.

```
client-app.com backend ──POST──▶ https://mcdi/api/inbound-webhooks/:id/submit
```

These are opposite arrows with almost no shared machinery. Outbound needs a retry
queue, backoff, and a delivery log; inbound needs validation, a synchronous error
body, and read authorization. Hence a distinct name — `inboundWebhook` — and a
distinct operation flag, `MANAGE_INBOUND_WEBHOOKS`, so that reading
`MANAGE_WEBHOOKS` in this codebase never becomes a four-way ambiguity.

---

## 3. Goals and Non-Goals

### 3.1 Goals

| # | Goal |
|---|---|
| G1 | A project can declare a typed, multi-step submission schema at webhook creation |
| G2 | Submissions are validated against that schema, with all field errors returned at once |
| G3 | Rich data types are supported: scalars, enums, nested objects, repeatable arrays, files |
| G4 | Multi-step flows can be filled incrementally (drafts) or submitted in one shot |
| G5 | Read access to submissions is gated by an explicit allowlist of Discord roles, declared **before** the webhook exists |
| G6 | Every read of submission data is audited |
| G7 | Ingest is authenticated by the existing project API key and integrity-protected by HMAC |
| G8 | Creating a project optionally provisions a default inbound webhook |

### 3.2 Non-Goals

| # | Non-goal | Rationale |
|---|---|---|
| N1 | Outbound event delivery / retry queue | Opposite direction; separate feature. `project.webhookUrl` stays untouched |
| N2 | A rendering front-end for the forms | The caller owns their UI; MCDI owns the contract and the data |
| N3 | Browser-direct submission from a public page | API-key auth means server-to-server. See [9.1](#91-why-server-to-server) |
| N4 | Posting submissions into Discord channels | Deliberately deferred; the sink is persistence only in v1 |
| N5 | Per-role field-level redaction | v2. v1 gates at the webhook level, not the field level |
| N6 | Payment, e-signature, or scheduling field types | Out of scope |

---

## 4. User Stories

**US-1 — Declare a form.** As a project developer, I create an inbound webhook with
a multi-step schema and a list of Discord roles that may read submissions, so that
my app has a validated backend without me hosting one.

**US-2 — Submit.** As a project backend, I POST a payload and either get `201` with
a submission id, or `422` with a complete list of which fields failed and why.

**US-3 — Fill across steps.** As a project backend serving a five-step wizard, I open
a draft, submit each step as the user completes it, upload a file at step three, and
finalize at step five.

**US-4 — Read, if entitled.** As a club member holding the `@Recruitment` role, I list
the submissions for the recruitment webhook and open individual entries, including
their attached files.

**US-5 — Denied, invisibly.** As a member without any granted role, the webhook is
indistinguishable from one that does not exist.

**US-6 — Accountability.** As a system admin, I can see who read which submissions,
when, and via which role grant.

---

## 5. Architecture

### 5.1 Request flow — ingest

```
Project backend
   │ POST /api/inbound-webhooks/:id/submit
   │ Authorization: Bearer pk_a8f3.<secret>
   │ X-MCDI-Signature: t=1759190400,v1=4f2b…
   │ Origin: https://app.client.com
   │ { "identity": { "name": "Ada", "firstname": "Lovelace" } }
   ▼
┌─────────────────────────────────────────────────────┐
│ ApiKeyGuard            project identity established │
│ 1. webhook belongs to this project?  → 404          │
│ 2. webhook active?                   → 410          │
│ 3. origin in acceptedOrigins?        → 403          │
│ 4. |now - t| <= 300s?                → 401          │
│ 5. HMAC(secret, "t." + rawBody) ok?  → 401          │
│ 6. signature replayed? (Redis SETNX) → 409          │
│ 7. rate limit (Redis)                → 429          │
│ 8. payload valid vs schema?          → 422 + errors │
└─────────────────────────────────────────────────────┘
   ▼
inbound_webhook_submissions   +   audit_logs('webhook')
```

### 5.2 Request flow — read

```
Club member (browser, Discord session)
   │ GET /api/inbound-webhooks/:id/submissions
   │ Authorization: Bearer <session token>
   ▼
┌─────────────────────────────────────────────────────┐
│ SessionGuard               → req.memberId           │
│ InboundWebhookReadGuard                             │
│   allowed  = roles granted on this webhook          │
│   held     = member's roles on the webhook's server │
│   allowed ∩ held ≠ ∅  OR  system admin   → allow    │
│   otherwise                              → 404      │
└─────────────────────────────────────────────────────┘
   ▼
paginated submissions   +   audit_logs('submissions.read')
```

### 5.3 Module layout

```
src/modules/inbound-webhooks/
  inbound-webhooks.module.ts
  inbound-webhooks.repository.ts
  inbound-webhooks.service.ts
  inbound-webhooks.controller.ts          admin CRUD          (SystemAdminGuard)
  inbound-webhook-ingest.controller.ts    write               (ApiKeyGuard)
  inbound-webhook-read.controller.ts      read                (SessionGuard + read guard)
  schema/
    form-schema.types.ts                  FormSchema, Field, Condition
    schema.validator.ts                   Layer 1 — validates the schema itself
    payload.validator.ts                  Layer 2 — validates a submission
    condition.evaluator.ts                tiny AST evaluator
  storage/
    storage.interface.ts
    s3.storage.ts
  guards/
    inbound-webhook-read.guard.ts
  dto/

src/common/utils/
  crypto.util.ts                          AES-256-GCM encrypt / decrypt
  inbound-webhook-signature.util.ts       sign / verify / parse header
```

---

## 6. Schema Definition Language

### 6.1 Top level

```ts
export type FormSchema = {
  version: 1;
  steps: FormStep[];
};

export type FormStep = {
  key: string;              // stable id, referenced by the draft API
  title?: string;
  description?: string;
  condition?: Condition;    // when false the whole step is skipped
  fields: Field[];
};
```

A single-step form is `steps: [{ key: 'default', fields: [...] }]`. There is one
code path; "simple" is the degenerate case of "multi-step", never a separate one.

### 6.2 Field types

Fields are a **discriminated union on `type`**, not a flat bag of optional
constraints. This makes `{ type: 'boolean', minLength: 5 }` a compile error rather
than a silently ignored property.

```ts
type BaseField = {
  key: string;
  label?: string;
  description?: string;
  required: boolean;
  condition?: Condition;
  default?: unknown;
};

type Field =
  // scalars
  | BaseField & { type: 'string';   minLength?: number; maxLength?: number;
                                    pattern?: string; trim?: boolean }
  | BaseField & { type: 'text';     maxLength?: number }
  | BaseField & { type: 'number';   min?: number; max?: number; integer?: boolean }
  | BaseField & { type: 'boolean' }
  | BaseField & { type: 'email';    allowedDomains?: string[] }
  | BaseField & { type: 'url';      allowedSchemes?: ('http' | 'https')[] }
  | BaseField & { type: 'phone';    region?: string }
  | BaseField & { type: 'date';     min?: string; max?: string }
  | BaseField & { type: 'datetime'; min?: string; max?: string }
  // choice
  | BaseField & { type: 'enum';       options: Option[] }
  | BaseField & { type: 'multi_enum'; options: Option[];
                                      minSelected?: number; maxSelected?: number }
  // composite (recursive)
  | BaseField & { type: 'object'; fields: Field[] }
  | BaseField & { type: 'array';  item: Field;
                                  minItems?: number; maxItems: number }
  // files
  | BaseField & { type: 'file';  accept: string[]; maxSizeBytes: number }
  | BaseField & { type: 'files'; accept: string[]; maxSizeBytes: number;
                                 minCount?: number; maxCount: number }
  // escape hatch
  | BaseField & { type: 'json'; maxBytes: number };

type Option = { value: string; label?: string };
```

`maxItems`, `maxCount`, and `maxBytes` are **required, not optional**. An unbounded
collection is an unbounded validation loop reachable from an authenticated endpoint.

### 6.3 Conditions

A deliberately tiny AST. Never `eval`, never a JS expression string.

```ts
type Condition =
  | { op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'exists';
      field: string;              // dotted path: "identity.status"
      value?: unknown }
  | { op: 'and' | 'or'; of: Condition[] }
  | { op: 'not'; of: Condition };
```

**Ordering rule:** conditions resolve **before** validation. The validator computes
the active field set first, then validates only that set. A `required` field inside
a false condition must not block submission, and any value sent for it is stripped.
Getting this backwards makes every branching form unsubmittable.

### 6.4 Two validation layers

| | Layer 1 — schema | Layer 2 — payload |
|---|---|---|
| Runs at | webhook create / update | every submission |
| Input | a `FormSchema` from an admin | a JSON body from a caller |
| Checks | duplicate keys, unknown `type`, uncompilable `pattern`, depth > 5, node count > 200, `condition` referencing an unknown or later-step field | types, coercion, constraints, conditions, file tokens |
| On failure | `400`, webhook not created | `422` with every error |

Separating these is the central design decision: by the time Layer 2 runs, the
schema is known-good, so it never recompiles a regex or re-checks structure.

**Limits (Layer 1).** Nesting depth ≤ 5; total field nodes ≤ 200; `pattern` source
≤ 200 chars and must compile inside `try/catch`. A stored pathological regex is a
ReDoS on every future submission, so it is rejected at write time.

### 6.5 Worked example

```json
{
  "version": 1,
  "steps": [
    {
      "key": "identity",
      "title": "Who are you?",
      "fields": [
        { "key": "firstname", "type": "string", "required": true, "maxLength": 80, "trim": true },
        { "key": "name",      "type": "string", "required": true, "maxLength": 80, "trim": true },
        { "key": "email",     "type": "email",  "required": true },
        { "key": "status",    "type": "enum",   "required": true,
          "options": [{ "value": "student" }, { "value": "professional" }] }
      ]
    },
    {
      "key": "background",
      "fields": [
        { "key": "university", "type": "string", "required": true,
          "condition": { "op": "eq", "field": "identity.status", "value": "student" } },
        { "key": "experience", "type": "array", "required": false, "maxItems": 10,
          "item": { "key": "entry", "type": "object", "required": true, "fields": [
            { "key": "company", "type": "string", "required": true },
            { "key": "years",   "type": "number", "required": true, "min": 0, "max": 60 }
          ]}}
      ]
    },
    {
      "key": "documents",
      "fields": [
        { "key": "cv", "type": "file", "required": true,
          "accept": ["application/pdf"], "maxSizeBytes": 5242880 },
        { "key": "portfolio", "type": "files", "required": false,
          "accept": ["image/png", "image/jpeg"], "maxSizeBytes": 2097152, "maxCount": 5 }
      ]
    }
  ]
}
```

Note that `background.university` references `identity.status` — an earlier step,
which is legal. A reference to a *later* step is rejected by Layer 1, because it
could never be satisfied at the moment the step is validated.

---

## 7. Data Model

Five new tables. Naming follows the `inbound_webhook*` prefix throughout.

### 7.1 `inbound_webhooks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects.id` | `onDelete: cascade` |
| `name` | varchar(255) | |
| `slug` | varchar(64) | unique per project |
| `schema` | jsonb | a `FormSchema`, Layer-1 validated |
| `accepted_origins` | jsonb `string[]` | allowlist; empty = no origin check |
| `signing_secret_enc` | text | AES-256-GCM ciphertext — **not** a hash |
| `require_signature` | boolean, default `true` | |
| `allow_role_inheritance` | boolean, default `false` | see [15](#15-open-decisions) |
| `is_active` | boolean, default `true` | |
| `submission_count` | integer, default `0` | |
| `last_submission_at` | timestamptz null | |
| `created_by` | varchar(255) | actor id |
| `created_at` / `updated_at` | timestamptz | |

**Why the signing secret is encrypted, not hashed.** `api-key.util.ts` stores only
`sha256(secret)` because verification compares hashes. HMAC verification is
different — the server must recompute `HMAC(secret, body)`, which requires the raw
secret. This is the single most important schema consequence of supporting signing.

### 7.2 `inbound_webhook_roles`

| Column | Type | Notes |
|---|---|---|
| `webhook_id` | uuid FK → `inbound_webhooks.id` | cascade |
| `role_id` | varchar(255) FK → `roles.id` | cascade |
| `granted_at` | timestamptz | |
| `granted_by` | varchar(255) | actor id |

PK `(webhook_id, role_id)`. Index on `role_id`.

Modeled on `project_roles`, **with the empty-set semantics inverted**:

```ts
/**
 * Discord roles permitted to READ this webhook's submissions.
 * NOTE: inverted relative to project_roles — empty means NOBODY (fail-closed),
 * because submissions carry user-supplied PII. At least one role is required
 * at creation and the set can never be emptied.
 */
```

`project_roles` documents "no entries = any authenticated user can access". That is
fail-*open* and is the wrong default for submission data. The docstring above must
ship with the entity so the next reader does not assume the neighbouring semantics.

### 7.3 `inbound_webhook_drafts`

`id`, `webhook_id`, `project_id`, `data` jsonb, `completed_steps` jsonb `string[]`,
`status` (`open` | `submitted` | `expired`), `expires_at`, timestamps.

### 7.4 `inbound_webhook_submissions`

`id`, `webhook_id`, `project_id`, `draft_id` null, `payload` jsonb, `ip_address`,
`origin`, `user_agent`, `received_at`.

`project_id` is denormalized deliberately, so every submission query can be scoped
without a join — the same trade-off `project_servers` already makes.

### 7.5 `inbound_webhook_files`

`id`, `webhook_id`, `draft_id` null, `submission_id` null, `storage_key`, `sha256`,
`size_bytes`, `mime`, `original_name`, `status` (`pending` | `committed` | `orphaned`),
`expires_at`, `created_at`.

### 7.6 Migration

Entities under `src/database/entities/`, exported from `index.ts`, then
`pnpm db:generate && pnpm db:migrate`. No changes to existing tables except the new
`MANAGE_INBOUND_WEBHOOKS` key in the `project_servers.operations` JSONB default,
which requires a backfill for existing rows.

---

## 8. API Surface

Three controllers, separated by **audience**, never mixed.

### 8.1 Management — `SystemAdminGuard`

```
POST   /admin/inbound-webhooks                      create (allowedRoleIds required)
GET    /admin/inbound-webhooks                      list, filterable by project
GET    /admin/inbound-webhooks/:id                  detail (secret never returned)
PATCH  /admin/inbound-webhooks/:id                  schema, origins, isActive
PUT    /admin/inbound-webhooks/:id/roles            replace grants (non-empty)
POST   /admin/inbound-webhooks/:id/rotate-secret    returns the secret once
DELETE /admin/inbound-webhooks/:id
```

### 8.2 Ingest — `ApiKeyGuard` + HMAC (write only)

```
POST   /inbound-webhooks/:id/files                       multipart, one file, streamed
POST   /inbound-webhooks/:id/drafts                      → { draftId, expiresAt }
PATCH  /inbound-webhooks/:id/drafts/:draftId/:stepKey    validates that step only
POST   /inbound-webhooks/:id/drafts/:draftId/submit      full validation, commits files
POST   /inbound-webhooks/:id/submit                      one-shot
```

The one-shot route is internally *create draft → apply all steps → submit*,
atomically. One validator serves both call styles.

**No read route is reachable with an API key.** A project writes; it does not read
back accumulated submissions.

### 8.3 Read — `SessionGuard` + `InboundWebhookReadGuard`

```
GET /inbound-webhooks                                  only those my roles allow
GET /inbound-webhooks/:id/submissions                  paginated
GET /inbound-webhooks/:id/submissions/:sid
GET /inbound-webhooks/:id/submissions/:sid/files/:fid  short-lived signed URL
GET /inbound-webhooks/:id/submissions/export           CSV (reuses csv.util.ts)
```

`GET /inbound-webhooks` must filter by the caller's roles **inside the query**, not
fetch-then-filter — otherwise the pagination total leaks how many webhooks exist
that the caller cannot see.

---

## 9. Security Model

### 9.1 Why server-to-server

Ingest authenticates with the project's existing API key (`pk_xxxx.<64 hex>`), which
is a bearer credential. A browser-side form posting directly would expose it in
client JS. Therefore **the caller is the project's own backend**, and the origin
allowlist is defense-in-depth on the calling server's `Origin` header, not a
browser-CORS mechanism. A genuinely public form endpoint would be a second ingest
mode with token-in-URL auth and no API key — explicitly out of scope for v1.

### 9.2 HMAC signatures

Header format:

```
X-MCDI-Signature: t=<unix seconds>,v1=<hex hmac-sha256>
```

The signed string is `"<t>.<raw request body>"`. Verification uses `timingSafeEqual`,
mirroring `verifyApiKey` in `api-key.util.ts:16`.

**Verify against the raw body, never `JSON.stringify(req.body)`** — key order and
whitespace do not survive the parse/serialize round-trip and every signature will
fail. This requires `src/main.ts:14` to become:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  rawBody: true,
});
```

Timestamp tolerance is ±300s. Replay protection is a Redis `SETNX` on the signature
for the tolerance window.

### 9.3 Threat table

| Threat | Mitigation |
|---|---|
| Stolen API key | HMAC signature is a second, separately-rotatable factor |
| Replayed request | timestamp window + Redis `SETNX` on the signature |
| Payload flooding | Redis rate limit per webhook and per project; body size cap |
| Malicious schema (ReDoS) | Layer 1 rejects at write time: depth, node count, regex length |
| Unbounded array | `maxItems` / `maxCount` mandatory in the type |
| Webhook enumeration | unauthorized reads return `404`, never `403` |
| Privilege escalation via foreign role | granted roles must belong to a server the project can access |
| PII exfiltration | every read audited; denials logged at `warning` |
| Disguised file upload | magic-byte sniffing, not the client's `Content-Type` |
| Permanent file URL outliving a grant | downloads are short-lived signed URLs behind the read guard |
| Secret at rest | AES-256-GCM; boot fails if `INBOUND_WEBHOOK_ENCRYPTION_KEY` is absent |

---

## 10. Role-Gated Read Access

The defining feature. Roles are declared **before** the webhook exists.

### 10.1 Two audiences

| | Submitters | Readers |
|---|---|---|
| Who | the project's backend | a human from the Discord server |
| Auth | API key + HMAC | Discord session |
| Guard | `ApiKeyGuard` (`api-key.guard.ts:33`) | `SessionGuard` (`session.guard.ts:37`) → `req.memberId` |
| Identity | a `projects` row | a `members` row |
| Gate | project owns the webhook | holds one of the granted roles |

### 10.2 Creation-time validation

Three checks, before the webhook row is written:

1. **Roles exist.** The FK catches it, but return a clean `400` naming the unknown
   ids — `projects.service.ts:60-72` already does exactly this for unknown server
   ids; copy that shape.
2. **Roles belong to a server the project can access.** Every role carries a
   `server_id` (`role.entity.ts:17`). Without this check, a grant via a role from an
   unrelated guild is a privilege-escalation path. Cross-reference `project_servers`.
3. **Roles are not `managed`.** `role.entity.ts:22` flags bot-managed roles.
   Granting data access via a role Discord hands out on bot-install is rarely
   intended. **Warn, do not block.**

The DTO enforces the non-empty invariant:

```ts
@IsArray()
@ArrayNotEmpty()
@IsString({ each: true })
@Matches(/^\d{17,20}$/, { each: true })
allowedRoleIds!: string[];
```

`PUT /roles` applies the same rule. Emptying the set is a deletion of the webhook,
not an edit of it.

### 10.3 Enforcement

`InboundWebhookReadGuard`, applied at the controller so it cannot be forgotten on a
new endpoint:

```
1. req.memberId                     (from SessionGuard)
2. webhookId from params → granted role ids        (Redis-cached)
3. member's role ids on that webhook's server      (uncached, indexed)
4. intersection non-empty            → allow
   else system admin                 → allow
   else                              → 404
```

**404, not 403.** A `403` confirms the webhook exists and that the caller merely
lacks permission — an enumeration oracle over the org's forms.

### 10.4 New repository method

Nothing today returns a member's plain role ids. `permissions.repository.ts` joins
`serverMemberRoles` → `roles` at lines 52, 74, and 110, but always to answer a
*permission* question. Add:

```ts
async findMemberRoleIds(memberId: string, serverId: string): Promise<string[]>
```

### 10.5 Staleness

Role membership is synced from Discord by the `sync` module. Cache the webhook's
*granted* role set (as `ProjectAccessCacheService` does for project-server access),
but keep the *member's* role lookup uncached — a cached membership means someone
stripped of a role keeps reading until the TTL expires. One indexed query is cheap;
start uncached and measure.

### 10.6 Audit

`actionType: 'webhook'` already exists in the enum (`audit-log.entity.ts:20`) and is
already a valid filter value (`query-audit-logs.dto.ts:18`), so this is nearly free.

```ts
{ actionType: 'webhook', action: 'submissions.read',
  entityType: 'inbound_webhook', entityId: webhookId,
  actorId: memberId,
  details: { count, filters, matchedViaRoleId },
  severity: 'info' }
```

Log **denials** too, at `severity: 'warning'`. Repeated denials against one webhook
is the signal that someone is probing.

---

## 11. File Handling

No upload infrastructure exists today — `multer` appears in `package.json:102` only
as a transitive `pnpm.overrides` security pin, not as a dependency. This is greenfield.

### 11.1 Two-phase upload

Files are **never** part of the submission request.

```
POST /inbound-webhooks/:id/files     multipart, streamed, ApiKeyGuard
  → { fileId, sha256, size, mime, expiresAt }

POST /inbound-webhooks/:id/submit    JSON, small, signable
  { "documents": { "cv": { "fileId": "iwf_a8f3…" } } }
```

Rationale:

- **Signing.** Verifying HMAC means buffering the whole raw body before the request
  is authenticated. A 50 MB multipart body is then a pre-auth memory exhaustion
  vector. Two-phase keeps the signed body small.
- **Multi-step.** A wizard uploads at step 2 but submits at step 5. A one-shot
  multipart request cannot express that.
- **Operations.** `sha256` keying gives dedup for free, and the upload endpoint is a
  natural hook point for virus scanning later.

### 11.2 Validation at submit

A `file` field checks that the token exists, belongs to *this* webhook, is still
`pending`, has not expired, and satisfies `accept` and `maxSizeBytes`. On success
rows flip to `committed` and link to the submission id.

### 11.3 MIME

Never trust the client's `Content-Type`. Sniff magic bytes (`file-type`) and match
against `accept`. An executable renamed to `.pdf` announces itself as
`application/pdf` quite happily. Enforce the size cap while streaming, not after
buffering.

### 11.4 Storage and lifecycle

S3-compatible object storage behind a `StorageAdapter` interface (MinIO in
`docker-compose` for local development), keyed by `sha256`. Postgres `bytea` will
work and will hurt later.

A sweeper deletes `pending` files past TTL. `audit.service.ts:12` already
establishes the `RETENTION_DAYS` + `setInterval` pattern to copy.

---

## 12. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INBOUND_WEBHOOK_ENCRYPTION_KEY` | **yes** | 32 bytes, base64. Boot **must fail** if absent — silently falling back to plaintext secrets is exactly the failure that ships |
| `INBOUND_WEBHOOK_MAX_BODY_BYTES` | no (default 1 MiB) | JSON submission cap |
| `INBOUND_WEBHOOK_SIGNATURE_TOLERANCE_S` | no (default 300) | timestamp window |
| `INBOUND_WEBHOOK_DRAFT_TTL_H` | no (default 24) | draft expiry |
| `INBOUND_WEBHOOK_FILE_TTL_H` | no (default 1) | pending-file expiry |
| `INBOUND_WEBHOOK_SUBMISSION_RETENTION_DAYS` | no (default 365) | retention sweep |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_REGION` | yes (files) | object storage |

---

## 13. Error Response Standard

Validation failures return `422` with **every** error, located by path:

```json
{
  "statusCode": 422,
  "error": "ValidationFailed",
  "errors": [
    { "path": "identity.firstname",  "code": "REQUIRED",        "message": "Field is required" },
    { "path": "background.experience[2].years", "code": "OUT_OF_RANGE", "message": "Must be between 0 and 60" },
    { "path": "documents.cv",        "code": "FILE_TOO_LARGE",  "message": "Exceeds 5242880 bytes" }
  ]
}
```

Returning only the first error forces a caller to debug their integration one round
trip at a time.

| Status | Condition |
|---|---|
| `201` | submission accepted |
| `400` | malformed schema (management), malformed JSON (ingest) |
| `401` | missing/invalid API key, bad or stale signature |
| `403` | origin not in allowlist |
| `404` | webhook not found **or** caller not entitled to read it |
| `409` | replayed signature |
| `410` | webhook inactive |
| `413` | body or file exceeds cap |
| `422` | payload failed schema validation |
| `429` | rate limited |

---

## 14. Testing Strategy

| Layer | Target | What |
|---|---|---|
| Unit | `schema.validator.ts` | one case per rejection rule; depth, node count, bad regex, forward reference |
| Unit | `payload.validator.ts` | table-driven, one case per type × constraint; conditions; nesting; error aggregation |
| Unit | `condition.evaluator.ts` | every operator, nested and/or/not, missing-path behaviour |
| Unit | `inbound-webhook-signature.util.ts` | round trip, tampered body, stale timestamp, malformed header |
| Unit | `crypto.util.ts` | round trip, wrong key fails, ciphertext differs per call (IV) |
| Unit | `InboundWebhookReadGuard` | entitled, unentitled, admin, revoked role, role on foreign server |
| E2E | ingest | happy path, 422 shape, replay, stale signature, origin rejection, rate limit |
| E2E | read | entitled member sees data; unentitled gets 404; list does not leak counts |
| E2E | drafts | step-by-step fill, resume, expiry, condition-skipped step |
| E2E | files | upload → submit → commit; orphan sweep; MIME mismatch rejected |

`test/projects.e2e-spec.ts` and `test/helpers/db.ts` are the existing patterns to
follow.

---

## 15. Open Decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | Does `role_inheritance_rules` apply to submission reads? | **No.** Data access should be explicit. "The president inherits everything" is a surprise when the form holds phone numbers. Exposed as the per-webhook `allow_role_inheritance` flag, default `false`, so it is visible per form rather than global |
| D2 | Submission retention period | 365 days default, configurable. Decide **before** the table has ten million rows |
| D3 | Per-role field-level redaction | v2. Would become `inbound_webhook_roles.visible_fields jsonb` |
| D4 | Public (no-API-key) ingest mode | Out of scope for v1; would be token-in-URL plus strict rate limiting |
| D5 | Rename `project.webhookUrl` → `event_callback_url` | Recommended, in the same migration, while nothing reads it |

---

## 16. Issue Breakdown

15 issues. `IW-01` through `IW-04` have no dependency on each other beyond the
schema types and can be parallelized across the team.

---

### IW-01 — Database schema and migration
**Labels**: `enhancement` · **Estimate**: M · **Depends on**: —

Create the five entities, export them, generate and apply the migration.

- [ ] `inbound-webhook.entity.ts`, `inbound-webhook-role.entity.ts`, `inbound-webhook-draft.entity.ts`, `inbound-webhook-submission.entity.ts`, `inbound-webhook-file.entity.ts`
- [ ] All five exported from `src/database/entities/index.ts`
- [ ] The inverted empty-set docstring ships on `inbound_webhook_roles`
- [ ] Indexes: `project_id`, `(project_id, slug)` unique, `role_id`, `(webhook_id, received_at)`
- [ ] `MANAGE_INBOUND_WEBHOOKS` added to `ProjectServerOperations` + `DEFAULT_PROJECT_SERVER_OPERATIONS`, defaulting to `false`, with a backfill for existing `project_servers` rows
- [ ] `pnpm db:generate && pnpm db:migrate` applies cleanly on a fresh and an existing database

---

### IW-02 — FormSchema types and Layer-1 schema validator
**Labels**: `enhancement` · **Estimate**: L · **Depends on**: —

Pure TypeScript. No Nest, no database.

- [ ] `form-schema.types.ts`: `FormSchema`, `FormStep`, `Field` discriminated union, `Condition`, `Option`
- [ ] `schema.validator.ts` → `{ ok: true } | { ok: false; errors: SchemaError[] }`
- [ ] Rejects: duplicate keys in a step/object, unknown `type`, depth > 5, node count > 200, `pattern` > 200 chars or uncompilable, missing mandatory `maxItems`/`maxCount`/`maxBytes`
- [ ] Rejects a `condition` referencing an unknown field or a field in a later step
- [ ] Unit tests: one per rejection rule, plus the valid example from §6.5

---

### IW-03 — Layer-2 payload validator and condition evaluator
**Labels**: `enhancement` · **Estimate**: XL · **Depends on**: IW-02

The core of the feature. Still pure — no Nest, no database.

- [ ] `condition.evaluator.ts`: every operator, `and`/`or`/`not`, safe on missing paths
- [ ] `payload.validator.ts`: resolves conditions **first**, then validates the active set
- [ ] Values for condition-inactive fields are stripped, and their `required` is not enforced
- [ ] Coercion: `"25"` → `25` for `number`; `"abc"` rejected
- [ ] Recursive over `object` and `array` with the depth cap re-enforced
- [ ] Unknown keys rejected or stripped per `rejectUnknownFields`
- [ ] Returns **all** errors with `path` locators including array indices
- [ ] Table-driven unit tests: one per type × constraint

---

### IW-04 — Crypto and HMAC signature utilities
**Labels**: `enhancement` · **Estimate**: M · **Depends on**: —

- [ ] `crypto.util.ts`: AES-256-GCM `encrypt`/`decrypt` using `INBOUND_WEBHOOK_ENCRYPTION_KEY`
- [ ] Boot fails loudly if the key is missing or not 32 bytes
- [ ] `inbound-webhook-signature.util.ts`: `sign`, `verify`, `parseSignatureHeader`
- [ ] `verify` uses `timingSafeEqual`, mirroring `api-key.util.ts:16`
- [ ] `rawBody: true` added at `src/main.ts:14`
- [ ] Unit tests: round trip, tampered body, stale timestamp, malformed header, wrong key

---

### IW-05 — Repository, service, and admin CRUD
**Labels**: `enhancement` · **Estimate**: L · **Depends on**: IW-01, IW-02, IW-04

- [ ] `inbound-webhooks.repository.ts` following `projects.repository.ts` conventions
- [ ] `inbound-webhooks.service.ts`: create, list, get, update, rotate secret, delete
- [ ] Create validates the schema through Layer 1 and returns `400` on failure
- [ ] **Role validation**: roles exist (clean `400` naming unknown ids); roles belong to a server the project can access; `managed` roles warn but do not block
- [ ] `ArrayNotEmpty` on `allowedRoleIds` in both the create DTO and `PUT /roles`
- [ ] Creation is one transaction: webhook + role grants + audit entry
- [ ] Signing secret returned exactly once, following the `CreateProjectResult` precedent at `projects.service.ts:29`
- [ ] Admin controller under `SystemAdminGuard` with full Swagger annotations
- [ ] Unit tests incl. the foreign-server role rejection

---

### IW-06 — Role-gated read access
**Labels**: `enhancement` · **Estimate**: L · **Depends on**: IW-05

The highest-risk issue in this PRD. A bug here shows one person's submissions to
another.

- [ ] `findMemberRoleIds(memberId, serverId)` in `permissions.repository.ts`
- [ ] `InboundWebhookReadGuard`: intersection, admin bypass, **404 on denial**
- [ ] Read controller under `SessionGuard` + the read guard
- [ ] `GET /inbound-webhooks` filters by role **in the query**, so totals do not leak
- [ ] Granted-role set cached in Redis; member role lookup left uncached
- [ ] Every successful read audited; denials audited at `severity: 'warning'`
- [ ] Unit tests: entitled, unentitled, admin, revoked role, role on a foreign server
- [ ] E2E: unentitled member receives `404`, and list totals exclude invisible webhooks

---

### IW-07 — Draft protocol for multi-step submissions
**Labels**: `enhancement` · **Estimate**: L · **Depends on**: IW-03, IW-05

- [ ] `POST /drafts`, `PATCH /drafts/:draftId/:stepKey`, `POST /drafts/:draftId/submit`
- [ ] Step patch validates only that step's active fields
- [ ] Submit validates the whole accumulated payload and resolves conditions across steps
- [ ] Draft TTL, `expired` status, and resume behaviour
- [ ] Submitting a draft twice is rejected
- [ ] E2E: step-by-step fill, resume, expiry, condition-skipped step

---

### IW-08 — File upload, storage, and lifecycle
**Labels**: `enhancement` · **Estimate**: XL · **Depends on**: IW-05

- [ ] `StorageAdapter` interface + S3 implementation; MinIO added to `docker-compose`
- [ ] `POST /inbound-webhooks/:id/files`: streamed, size-capped during streaming
- [ ] Magic-byte MIME sniffing via `file-type`, matched against `accept`
- [ ] Rows keyed by `sha256`; `pending` → `committed` on submission
- [ ] Orphan sweeper following the `audit.service.ts:12` interval pattern
- [ ] E2E: upload → submit → commit; MIME mismatch rejected; oversize rejected; orphan swept

---

### IW-09 — One-shot ingest endpoint
**Labels**: `enhancement` · **Estimate**: M · **Depends on**: IW-03, IW-04, IW-07

- [ ] `POST /inbound-webhooks/:id/submit` under `ApiKeyGuard`
- [ ] Full check chain in the order given in §5.1
- [ ] Origin allowlist check → `403`
- [ ] Signature verification against `req.rawBody` → `401`; replay → `409`
- [ ] Redis rate limit per webhook and per project → `429`
- [ ] Internally create-draft → apply → submit, atomically
- [ ] `submission_count` and `last_submission_at` updated
- [ ] E2E: happy path, 422 shape, replay, stale signature, origin rejection, rate limit

---

### IW-10 — Signed download URLs for submission files
**Labels**: `enhancement` · **Estimate**: M · **Depends on**: IW-06, IW-08

- [ ] `GET /inbound-webhooks/:id/submissions/:sid/files/:fid` behind the read guard
- [ ] Returns a short-lived signed URL, never a permanent storage URL
- [ ] Download issuance is audited
- [ ] E2E: unentitled member receives `404`; expired URL is rejected

---

### IW-11 — Wire into project creation
**Labels**: `enhancement` · **Estimate**: S · **Depends on**: IW-05

- [ ] Optional `inboundWebhook` block on `CreateProjectDto` (`name`, `schema`, `allowedRoleIds`, `acceptedOrigins`)
- [ ] `ProjectsService.create` provisions it in the same transaction, after `projectsRepository.create` at `projects.service.ts:74`
- [ ] `CreateProjectResult` extended; signing secret returned once alongside `apiKey`
- [ ] Dependency stays one-way — `InboundWebhooksModule` imports nothing from `ProjectsModule` but types, to avoid `forwardRef`
- [ ] `projects.service.spec.ts` updated (it asserts on the create path)

---

### IW-12 — Audit coverage
**Labels**: `enhancement` · **Estimate**: S · **Depends on**: IW-05, IW-06

- [ ] Audited actions: `webhook.created`, `webhook.updated`, `webhook.deleted`, `roles.granted`, `roles.revoked`, `secret.rotated`, `submission.received`, `submissions.read`, `submission.file.downloaded`, `read.denied`
- [ ] All use the existing `actionType: 'webhook'` enum value
- [ ] Denials at `severity: 'warning'`
- [ ] Verified visible through the existing `/admin/audit` filters

---

### IW-13 — Retention and cleanup jobs
**Labels**: `enhancement` · **Estimate**: M · **Depends on**: IW-07, IW-08

- [ ] Expired drafts swept
- [ ] Orphan `pending` files deleted from storage **and** database
- [ ] Submissions past `INBOUND_WEBHOOK_SUBMISSION_RETENTION_DAYS` deleted with their files
- [ ] Follows the `RETENTION_DAYS` + `setInterval` pattern at `audit.service.ts:12`
- [ ] Each run logs counts

---

### IW-14 — CSV export of submissions
**Labels**: `enhancement` · **Estimate**: S · **Depends on**: IW-06

- [ ] `GET /inbound-webhooks/:id/submissions/export` behind the read guard
- [ ] Reuses `csv.util.ts`; flattens nested objects and arrays to dotted columns
- [ ] Files appear as their download identifiers, not inlined content
- [ ] Row cap mirroring `MAX_EXPORT_ROWS` in `audit.service.ts:14`
- [ ] Export is audited

---

### IW-15 — Documentation and OpenAPI
**Labels**: `documentation` · **Estimate**: S · **Depends on**: IW-09, IW-06

- [ ] Every endpoint annotated with `@ApiOperation` / response decorators, matching `projects.controller.ts`
- [ ] `docs/inbound-webhooks-integration.md`: a worked integration, signature pseudocode in JS and Python, the full error table
- [ ] README section
- [ ] `.env.example` updated with every variable from §12

---

## 17. Dependency Graph

```
IW-01 ──┬─────────────────────────────▶ IW-05 ──┬──▶ IW-06 ──┬──▶ IW-10
IW-02 ──┼──▶ IW-03 ──┬────────────────▶        │            ├──▶ IW-14
IW-04 ──┘            │                          ├──▶ IW-07 ──┴──▶ IW-09
                     └──────────────────────────┤            │
                                                ├──▶ IW-08 ──┘
                                                ├──▶ IW-11
                                                └──▶ IW-12 ──▶ IW-13 ──▶ IW-15
```

**Parallelizable immediately**: IW-01, IW-02, IW-04 — three developers, no contention.
**Critical path**: IW-02 → IW-03 → IW-05 → IW-06.
**Do not rush IW-06.** A defect in the validator returns a wrong `422`; a defect in
the read guard discloses personal data.
