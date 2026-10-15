# mcid-cli CLI
## Product Requirements Document

> **Status**: Draft
> **Focus**: A developer CLI for authenticating against MCID and managing Inbound Webhooks (schema-validated form backends) from the terminal
> **Target audience**: MCID core/internal developers (MicroClub-USTHB team)
> **Depends on**: MCID's Inbound Webhooks feature (`docs/MCID-INBOUND-WEBHOOKS-PRD.md`, branch `feat/inbound-webhooks`) — **not yet merged**. mcid-cli cannot ship ahead of that feature landing on `main`.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Target Users](#3-target-users)
4. [Terminology](#4-terminology)
5. [Authentication and Profiles](#5-authentication-and-profiles)
6. [Config File](#6-config-file)
7. [CLI Command Surface](#7-cli-command-surface)
8. [Schema File Format](#8-schema-file-format)
9. [Local Validation Engine](#9-local-validation-engine)
10. [Interactive Mode](#10-interactive-mode)
11. [Output, Errors, and Exit Codes](#11-output-errors-and-exit-codes)
12. [Security Considerations](#12-security-considerations)
13. [Dependencies on MCID Backend](#13-dependencies-on-mcid-backend)
14. [Open Questions](#14-open-questions)
15. [Milestones](#15-milestones)

---

## 1. Executive Summary

### 1.1 Problem

Creating an MCID Inbound Webhook today means hand-crafting a `FormSchema` JSON
object, remembering the exact field-type union and its mandatory constraints
(`maxItems`, `maxCount`, `maxBytes`), and sending it with a raw HTTP client to
`POST /admin/inbound-webhooks`. There is no tooling to author, validate, or
iterate on a schema before it reaches the server, and no record on the
developer's machine of which webhooks exist, which project they belong to, or
what their rotated secrets were.

### 1.2 Solution

**mcid-cli**: a CLI that lets an MCID developer authenticate once, then
author, validate, create, update, and inspect Inbound Webhooks against a
chosen MCID environment — from a JSON file, from an interactive wizard, or
both.

In one sentence: *a local authoring and validation layer in front of MCID's
own Inbound Webhooks API, so a bad schema is caught on the developer's laptop,
not as a `400` from the server.*

### 1.3 Why this is a thin client, not a second source of truth

MCID's Inbound Webhooks feature already owns schema validation (Layer 1,
schema-time) and payload validation (Layer 2, submission-time) — see
`docs/MCID-INBOUND-WEBHOOKS-PRD.md §6.4`. mcid-cli does **not** reimplement
server-side authority. Its validation layer is a fast, offline **pre-check**
that mirrors MCID's known Layer-1 rules so obvious mistakes fail in
milliseconds instead of a round trip, plus house rules the team wants
enforced before a schema is even proposed (see [§9](#9-local-validation-engine)).
The server remains the final authority; mcid-cli never bypasses it.

---

## 2. Goals and Non-Goals

### 2.1 Goals

| # | Goal |
|---|---|
| G1 | A developer authenticates once via browser-based OAuth and stays logged in across sessions |
| G2 | A developer can manage multiple named profiles (e.g. `local`, `staging`, `prod`), each pointing at a different MCID base URL and holding its own session |
| G3 | A developer can scaffold a new webhook schema JSON file from a template |
| G4 | A developer can validate a schema JSON file locally, with clear per-field errors, before sending anything to MCID |
| G5 | A developer can create, update, list, inspect, and delete Inbound Webhooks via `mcid-cli webhook ...` commands backed by a JSON file |
| G6 | A developer can build a schema interactively (step/field wizard) without hand-writing JSON, and optionally save the result to a file |
| G7 | A developer can set/replace the allowed-reader-roles list and rotate a webhook's signing secret |
| G8 | Validation errors are reported in a CLI-friendly form that mirrors MCID's `422` error shape (`path`, `code`, `message`) so the two are easy to reconcile |

### 2.2 Non-Goals

| # | Non-goal | Rationale |
|---|---|---|
| N1 | Submitting data *into* a webhook (the ingest side) | Ingest is server-to-server with an API key + HMAC, meant for a project's own backend, not a human operator's CLI. Out of scope for v1. |
| N2 | Reading/exporting submission data | That's the role-gated read surface for Discord members in a browser session, not a developer tool. Out of scope for v1. |
| N3 | Managing projects, servers, or role grants unrelated to Inbound Webhooks | Out of scope; mcid-cli is scoped to the Inbound Webhooks surface only. |
| N4 | A GUI or TUI dashboard | Terminal wizard only; no curses-style interface in v1. |
| N5 | Defining MCID's validation rules | mcid-cli's local rules are a pre-check; the server's Layer 1/Layer 2 remain authoritative and unmodified by this project. |

---

## 3. Target Users

MCID core/internal developers who are also MCID **system admins** — the same
people who today would call `POST /admin/inbound-webhooks` by hand or via
Postman. The admin webhook-management API is gated by `SystemAdminGuard`
(`docs/MCID-INBOUND-WEBHOOKS-PRD.md §8.1`), so mcid-cli's users are, by
construction, a small, trusted internal group — not external integrators.

---

## 4. Terminology

| Term | Meaning |
|---|---|
| **Profile** | A named, stored combination of an MCID base URL + an authenticated session, kept in the config file |
| **Schema file** | A JSON file describing a `FormSchema` (MCID's term) — steps, fields, conditions — see [§8](#8-schema-file-format) |
| **Webhook** | An MCID Inbound Webhook resource (`inbound_webhooks` row); what mcid-cli creates/updates/reads |
| **Pre-check** | mcid-cli's local validation pass, run before any network call |

---

## 5. Authentication and Profiles

### 5.1 Flow

mcid-cli uses browser-based OAuth, consistent with how every other MCID admin
surface authenticates today (Discord OAuth via MCID's `/api/auth/sso/authorize`
flow, `docs/auth-integration.md`):

```
$ mcid-cli login [--profile prod] [--base-url https://mcid.example.com]

1. mcid-cli starts a short-lived local HTTP listener on 127.0.0.1:<ephemeral port>
2. mcid-cli opens the system browser to:
     <base-url>/api/auth/sso/authorize?redirect_uri=http://127.0.0.1:<port>/callback
3. The developer completes Discord OAuth in the browser, as a system admin
4. MCID redirects to the local callback with a short-lived authorization code
5. mcid-cli exchanges the code for a session (mirrors /api/auth/token semantics)
6. The session is stored under the named profile in the config file
7. The local listener shuts down; CLI prints "Logged in as <admin> on <profile>"
```

`mcid-cli logout [--profile <name>]` clears the stored session for that
profile (or the active one). `mcid-cli whoami [--profile <name>]` calls a
session-introspection endpoint and prints the authenticated admin's identity
and the profile's base URL.

### 5.2 Multiple profiles

```
$ mcid-cli profile list
$ mcid-cli profile add staging --base-url https://staging.mcid.internal
$ mcid-cli profile use staging
$ mcid-cli profile remove staging
```

Exactly one profile is "active" at a time (used when `--profile` is omitted).
Every state-changing command accepts `--profile <name>` to target a
non-default profile explicitly, so a CI script or a one-off command never
depends on hidden local state.

### 5.3 Session refresh

Sessions expire. On a `401` from MCID, mcid-cli attempts a silent refresh
(mirroring `/api/auth/refresh`) once; if that fails, it prints a clear
"session expired, run `mcid-cli login --profile <name>`" message and exits
non-zero rather than looping.

---

## 6. Config File

### 6.1 Location

`~/.mcid-cli/config.json` (override via `MCID_CLI_CONFIG_PATH`), file mode `0600`.

### 6.2 Shape

```json
{
  "version": 1,
  "activeProfile": "prod",
  "profiles": {
    "prod": {
      "baseUrl": "https://mcid.microclub-usthb.org",
      "session": {
        "accessToken": "<encrypted-at-rest>",
        "refreshToken": "<encrypted-at-rest>",
        "expiresAt": "2026-10-09T12:00:00Z",
        "adminIdentity": "wailbentafat#discord-id"
      }
    },
    "local": {
      "baseUrl": "http://localhost:3000",
      "session": null
    }
  }
}
```

Tokens are encrypted at rest (see [§12.1](#121-credential-storage)); the JSON
on disk never holds a plaintext token. `mcid-cli config path` prints the
resolved config file location; `mcid-cli config show --profile <name>` prints
the profile with secrets redacted.

---

## 7. CLI Command Surface

```
mcid-cli login [--profile <name>] [--base-url <url>]
mcid-cli logout [--profile <name>]
mcid-cli whoami [--profile <name>]

mcid-cli profile list
mcid-cli profile add <name> --base-url <url>
mcid-cli profile use <name>
mcid-cli profile remove <name>

mcid-cli schema init [<path>] [--template <name>]
                                    scaffold a starter FormSchema JSON file
mcid-cli schema validate <path>
                                    run the local pre-check only, no network call
mcid-cli schema build [<path>] [--from <path>]
                                    launch the interactive wizard (§10);
                                    writes/overwrites <path> on completion

mcid-cli webhook create <schema-path> --name <name> --project <project-id> \
    --roles <roleId>[,<roleId>...] [--accept-origin <origin>]...
                                    pre-checks, then POST /admin/inbound-webhooks
mcid-cli webhook update <id> [--schema <path>] [--name <name>] [--active|--inactive]
mcid-cli webhook list [--project <project-id>]
mcid-cli webhook get <id> [--schema-only] [--json]
mcid-cli webhook delete <id> [--yes]
mcid-cli webhook roles set <id> --roles <roleId>[,<roleId>...]
mcid-cli webhook rotate-secret <id>
                                    prints the new secret once; never re-displayed
mcid-cli webhook diff <id> <schema-path>
                                    pre-checks <schema-path>, then diffs it
                                    against the webhook's live schema
```

Every command that targets an environment accepts `--profile <name>`. Every
command supports `--json` for machine-readable output (for use in scripts/CI).

---

## 8. Schema File Format

mcid-cli's schema files are, byte-for-byte, MCID's `FormSchema` type
(`docs/MCID-INBOUND-WEBHOOKS-PRD.md §6`) — mcid-cli introduces no parallel
format. This is deliberate: a file that validates locally is the same file
MCID's Layer 1 will see.

```ts
type FormSchema = { version: 1; steps: FormStep[] };
type FormStep = { key: string; title?: string; description?: string;
                   condition?: Condition; fields: Field[] };
```

Field types (16 total, discriminated on `type`): `string`, `text`, `number`,
`boolean`, `email`, `url`, `phone`, `date`, `datetime`, `enum`, `multi_enum`,
`object`, `array`, `file`, `files`, `json`. Composite types (`object`,
`array`) nest recursively; `array`/`files` require `maxItems`/`maxCount`,
and `json`/`file`/`files` require `maxBytes`/`maxSizeBytes`.

`mcid-cli schema init` scaffolds a minimal valid file:

```json
{
  "version": 1,
  "steps": [
    { "key": "default", "fields": [
      { "key": "example", "type": "string", "required": true, "maxLength": 80 }
    ]}
  ]
}
```

`--template recruitment` (and similar named templates) scaffold a fuller
example matching the worked example in the Inbound Webhooks PRD §6.5, for
teams that want a starting point closer to a real form.

---

## 9. Local Validation Engine

### 9.1 Two tiers

| Tier | Source of rules | Examples |
|---|---|---|
| **Built-in (mirrors MCID Layer 1)** | Hardcoded to MCID's schema types and validator implementation | Unknown `type` or field property, duplicate step/field keys or option values, unsafe or overlong keys, too many steps, missing or malformed type-specific properties, nesting depth > 5, more than 200 field nodes, invalid ranges or enum options, invalid/overlong patterns, malformed conditions, or a condition referencing an unknown, later, or array-item field |
| **Custom rule engine** | User/org-defined, loaded from `.mcid-cli/rules/*.json` (project-local) or `~/.mcid-cli/rules/*.json` (global), merged with built-ins | Reject `<`/`>` in any `string`/`text` field's `pattern` test values or `default`; enforce `label` is present on every field; enforce `key` naming convention (`^[a-z][a-z0-9_]*$`); cap `maxLength` at a house maximum; require at least one `file`/`files` field to have `accept` restricted to an allowlist of MIME types |

Built-in rules can never be disabled — they exist so a schema that passes
locally will also pass Layer 1 on the server. Custom rules are additive: a
team can only make local validation *stricter* than MCID's own Layer 1, never
looser (a custom rule cannot relax a built-in).

### 9.2 Rule definition format

```json
{
  "rules": [
    {
      "id": "no-angle-brackets-in-defaults",
      "appliesTo": ["string", "text"],
      "type": "forbid-pattern",
      "pattern": "[<>]",
      "message": "Field defaults/examples must not contain '<' or '>'"
    },
    {
      "id": "require-label",
      "appliesTo": "*",
      "type": "require-present",
      "field": "label",
      "message": "Every field must declare a human-readable label"
    }
  ]
}
```

Supported rule `type`s for v1: `forbid-pattern` (regex on a named field's
value), `require-present` (a named property must be set), `max-value`
(numeric ceiling on a named numeric constraint, e.g. `maxLength`),
`key-pattern` (regex the `key` must match). This is intentionally a small,
closed set rather than an embedded scripting language — consistent with
MCID's own "never `eval`, never a JS expression string" stance on its
condition AST (`docs/MCID-INBOUND-WEBHOOKS-PRD.md §6.3`).

### 9.3 Output shape

Pre-check failures are printed in the same `path` / `code` / `message` shape
as MCID's own `422` response (`docs/MCID-INBOUND-WEBHOOKS-PRD.md §13`), with
a `source: "local"` or `source: "mcid"` tag so a developer can tell which
layer caught the problem:

```
✗ 2 validation errors (source: local)
  steps[1].fields[2].pattern     PATTERN_TOO_LONG       Pattern exceeds 200 characters
  steps[2].fields[0].default     NO_ANGLE_BRACKETS       Field defaults must not contain '<' or '>'
```

---

## 10. Interactive Mode

`mcid-cli schema build` walks the developer through constructing a
`FormSchema` without writing JSON by hand:

1. **Steps**: add a step (`key`, optional `title`/`description`), reorder, or finish
2. **Fields per step**: pick a type from the 16-type list, then prompt only
   for that type's relevant constraints (e.g. picking `array` prompts for
   `item` type and `maxItems`; picking `file` prompts for `accept` and
   `maxSizeBytes` — never both)
3. **Conditions**: optionally attach a condition to a field or step, built
   from a guided `field / operator / value` picker restricted to the fields
   already defined in earlier steps (later-step references are not offered,
   since MCID's Layer 1 rejects them)
4. **Review**: prints the assembled JSON, runs it through the local
   pre-check (§9), and shows errors inline before allowing save
5. **Save**: writes to the given path (or prompts for one); optionally
   proceeds straight into `mcid-cli webhook create` with the freshly built file

Interactive mode and the JSON file are two entry points to the same object —
a file built interactively can be edited by hand afterward, and a hand-written
file can be opened in the wizard for editing (`schema build --from <path>`).

---

## 11. Output, Errors, and Exit Codes

| Exit code | Meaning |
|---|---|
| `0` | Success |
| `1` | Local pre-check failed (no network call made) |
| `2` | MCID rejected the request (`400`/`422`) — server-side validation failure |
| `3` | Authentication/session error (not logged in, expired, refresh failed) |
| `4` | Resource not found / not entitled (`404`) — matches MCID's enumeration-safe convention; mcid-cli does not attempt to distinguish "doesn't exist" from "you can't see it" |
| `5` | Network/unexpected error |

`--json` on any command emits a single JSON object to stdout with `ok`,
`data`/`errors`, and `source`, suitable for piping into other tooling or CI
checks. Human-readable output goes to stdout; all prompts and interactive
UI go to stderr so piping stays clean.

---

## 12. Security Considerations

### 12.1 Credential storage

Access/refresh tokens are encrypted at rest using a key derived from the OS
keychain where available (macOS Keychain / libsecret on Linux), falling back
to a locally-generated key file at `~/.mcid-cli/key` (mode `0600`) with a
loud warning on first use that this fallback is weaker than OS-keychain
storage. mcid-cli never writes a plaintext token to disk, to a log, or to
`--json` output.

### 12.2 Signing secrets

`mcid-cli webhook rotate-secret` prints the new HMAC signing secret exactly
once, mirroring MCID's own "secret returned exactly once" design
(`docs/MCID-INBOUND-WEBHOOKS-PRD.md §7.1`). mcid-cli does **not** persist the
secret anywhere — not in the config file, not in a log, not in shell
history-visible output by default (printed with a `--reveal` flag required,
otherwise masked with a copy-to-clipboard option).

### 12.3 Least privilege

mcid-cli only ever calls the `/admin/inbound-webhooks/*` surface under the
developer's own system-admin session. It has no code path that touches the
ingest (`ApiKeyGuard`) or read (`SessionGuard` + role guard) surfaces, so a
compromised mcid-cli install cannot be used to submit or read submission data
— only to manage webhook definitions, same as the admin's own browser
session already could.

### 12.4 Local file handling

Schema files and rule files are read as plain JSON; mcid-cli never executes
code found in them (consistent with the "closed rule-type set" decision in
§9.2). Config and schema file paths are never templated into shell commands.

---

## 13. Dependencies on MCID Backend

| # | Dependency | Status | Notes |
|---|---|---|---|
| D1 | Inbound Webhooks feature merged to `main` | **Blocking** — currently on unmerged branch `feat/inbound-webhooks` | mcid-cli has nothing to call against until this ships |
| D2 | A CLI-friendly OAuth redirect target | **Gap** | MCID's documented OAuth flow (`docs/auth-integration.md`) is browser-cookie-based (`mcid_sso` httpOnly cookie) for web apps. A CLI needs a loopback-redirect-capable authorize flow that returns a bearer session usable from a non-browser HTTP client, not just a cookie. This needs confirmation/implementation on the MCID side before `mcid-cli login` can be built as specified in §5.1 |
| D3 | Session introspection endpoint | **Gap** | `mcid-cli whoami` needs an endpoint that returns the authenticated admin's identity from a session token; confirm one exists or needs adding |
| D4 | Stable Inbound Webhooks API surface | Tracked | mcid-cli's commands map directly to `docs/MCID-INBOUND-WEBHOOKS-PRD.md §8.1`; any path/shape change there is a breaking change for mcid-cli |

---

## 14. Open Questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should mcid-cli support non-interactive/CI use (e.g. a service-account-style credential instead of interactive OAuth) for pipeline-driven webhook deployment? | Likely yes as a v2 addition (`mcid-cli login --token <pat>`), once MCID has a personal-access-token concept; out of scope for v1 |
| Q2 | Should `webhook diff` support applying the diff (`webhook update` from the diff), or only display it? | Recommend display-only in v1; apply requires re-running the full pre-check anyway, so `webhook update` already covers it |
| Q3 | Should custom validation rules be shareable/versioned across the team (e.g. committed to the MCID monorepo under `.mcid-cli/rules/`)? | Recommend yes — ship a default rule set in this repo so every developer gets the same house rules without manual setup |
| Q4 | Distribution: npm package, Homebrew, or a single compiled binary? | Defer to implementation phase; npm package (`npx mcid-cli` / global install) is the lowest-friction start given the team already runs a pnpm/Node monorepo |

---

## 15. Milestones

| Phase | Scope |
|---|---|
| **M0** | Blocked on D1 — Inbound Webhooks feature merged to `main` |
| **M1** | Auth (`login`/`logout`/`whoami`/`profile *`), config file, built-in local validation engine, `schema init`/`validate` |
| **M2** | `webhook create`/`get`/`list`/`update`/`delete`, `webhook roles set`, `webhook rotate-secret` |
| **M3** | Interactive `schema build` wizard |
| **M4** | Custom rule engine (`.mcid-cli/rules/*.json`), `webhook diff`, `--json` output across all commands |
