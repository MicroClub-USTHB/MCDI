# Draft issues for MicroClub-USTHB/m-forge

Review before I create these with `gh issue create`. Each one is a
requirement framed as a user story with acceptance criteria to accept/reject
— not full technical specs. Labels are suggestions.

---

### 1. `m-forge login` opens the system browser for Discord OAuth

**Labels:** `feature`, `auth`, `M1`

As a developer, when I run `m-forge login`, I want my system browser to open
straight to Discord's consent screen, so I never have to manually copy a URL
into a browser.

**Acceptance criteria**
- [ ] `m-forge login [--profile <name>] [--base-url <url>]` starts a local
      loopback HTTP listener on an ephemeral port.
- [ ] It calls `GET /api/auth/admin/discord` and opens the returned `url` in
      the system default browser automatically.
- [ ] After Discord consent, the CLI receives the resulting session without
      further manual steps, stores it under the named profile, and prints
      `Logged in as <admin> on <profile>`.
- [ ] If the browser can't be opened automatically, the URL is printed so it
      can be opened manually as a fallback.
- [ ] Blocked on issue #2 (MCDI needs to support redirecting the OAuth result
      back to the CLI's loopback listener).

(docs/endpoints/login/)

---

### 2. MCDI: admin OAuth callback needs a CLI-friendly redirect target

**Labels:** `dependency`, `mcdi`, `blocking`

As m-forge, I need MCDI's admin Discord OAuth callback to hand the resulting
session back to a caller-supplied loopback URL, not only to the configured
admin web frontend, so a CLI running on the developer's machine can receive
the session without needing to read a cookie.

**Acceptance criteria**
- [ ] `GET /api/auth/admin/discord` (or a CLI-specific variant) accepts a
      caller-supplied `redirect_uri`, restricted to loopback addresses
      (`127.0.0.1`/`localhost`) for this flow.
- [ ] After successful Discord auth, MCDI redirects to that `redirect_uri`
      with a short-lived code or the session token — not only via an
      httpOnly cookie.
- [ ] The existing admin-frontend cookie flow is unaffected for the web
      admin panel.
- [ ] This is filed against MCDI, not m-forge — tracked here because it
      blocks issue #1.

(docs/endpoints/login/ — "Gaps for m-forge")

---

### 3. `m-forge whoami` prints the authenticated admin's identity

**Labels:** `feature`, `auth`, `M1`

As a developer, I want `m-forge whoami [--profile <name>]` to confirm who
I'm logged in as and on which MCDI base URL, so I can sanity-check my active
session before running a state-changing command.

**Acceptance criteria**
- [ ] Calls `GET /api/auth/admin/me` with the stored session's Bearer token.
- [ ] Prints the admin's username/display name and the profile's base URL
      on success.
- [ ] On `401`, prints "session expired, run `m-forge login --profile
      <name>`" and exits non-zero — no silent retry loop (there is no
      refresh endpoint for this session type).
- [ ] `--json` emits the raw profile response.

(docs/endpoints/login/ — this endpoint already exists on MCDI, no backend
dependency)

---

### 4. `m-forge logout` clears the local and server-side session

**Labels:** `feature`, `auth`, `M1`

As a developer, I want `m-forge logout [--profile <name>]` to invalidate my
session on MCDI and forget it locally, so a stolen laptop doesn't keep a
live session around.

**Acceptance criteria**
- [ ] Calls `POST /api/auth/admin/logout` with the stored session's Bearer
      token.
- [ ] Clears the session from the named (or active) profile locally
      regardless of whether the server call succeeds (an already-expired
      session should still be clearable).
- [ ] Prints confirmation of which profile was logged out.

---

### 5. `schema init`/`validate` implement the built-in (Layer-1-mirroring) pre-check

**Labels:** `feature`, `validation`, `M1`

As a developer, I want `m-forge schema validate <path>` to catch the same
schema mistakes MCDI's server would reject, entirely offline, so a bad
schema fails in milliseconds instead of as a `400`/`422` from the API.

**Acceptance criteria**
- [ ] `m-forge schema init [<path>] [--template <name>]` scaffolds a minimal
      valid `FormSchema` JSON file (and a fuller one per named template, e.g.
      `--template recruitment`).
- [ ] `m-forge schema validate <path>` runs a local, offline pre-check — no
      network call — and exits `0` on pass, `1` on failure.
- [ ] The built-in rule set mirrors MCDI's server-side Layer 1 exactly and
      can never be disabled: unknown field `type`, duplicate keys within a
      step/object, nesting depth > 5, node count > 200, missing mandatory
      `maxItems`/`maxCount` (array/files) or `maxBytes`/`maxSizeBytes`
      (json/file/files), an uncompilable or >200-char `pattern`, and a
      `condition` referencing an unknown field or a field defined in a later
      step.
- [ ] Failures print in the same `path` / `code` / `message` shape as MCDI's
      own `422` response, tagged `source: "local"` so it's distinguishable
      from a server-side rejection.
- [ ] `webhook create`/`update` (issue #7) reuse this same pre-check before
      making any network call.

(docs/MCDI-INBOUND-WEBHOOKS-PRD.md §6.4 is the server-side rule source of
truth this must mirror — re-verify against it, not just the m-forge PRD's
summary, since it can drift.)

---

### 6. Custom validation rule engine (`.m-forge/rules/*.json`)

**Labels:** `feature`, `validation`, `M4`

As a team lead, I want to add house rules on top of MCDI's own validation
(e.g. "every field needs a `label`", "field keys must be `snake_case`"), so
my team catches team-specific mistakes before they ever reach MCDI, without
needing MCDI itself to enforce them for everyone.

**Acceptance criteria**
- [ ] Custom rules are loaded from `.m-forge/rules/*.json` (project-local) and
      `~/.m-forge/rules/*.json` (global), merged with the built-ins from
      issue #5.
- [ ] Supported rule `type`s: `forbid-pattern` (regex on a named field's
      value), `require-present` (a named property must be set), `max-value`
      (numeric ceiling on a named constraint), `key-pattern` (regex the
      field `key` must match). No embedded scripting/`eval` — a closed set
      only.
- [ ] Custom rules are strictly additive — they can only make local
      validation *stricter* than MCDI's Layer 1, never looser; a custom rule
      can't disable or relax a built-in rule.
- [ ] Rule files are read as plain JSON and never executed as code.
- [ ] Failing a custom rule reports in the same `path`/`code`/`message`
      shape as a built-in failure, still tagged `source: "local"`.

---

### 7. `webhook create` sends a validated schema and shows the signing secret once

**Labels:** `feature`, `webhook`, `M2`

As a developer, I want `m-forge webhook create <schema-path> --name <name>
--project <id> --roles <roleId>[,...]` to pre-check my schema locally, then
create the webhook on MCDI and show me the signing secret exactly once, so I
never have to go dig it out of a database.

**Acceptance criteria**
- [ ] Runs the local pre-check from issue #5 (built-in rules, plus any custom
      rules from issue #6) before any network call; exits non-zero with
      per-field errors if it fails — no call is made on failure.
- [ ] On pass, calls `POST /admin/inbound-webhooks` with `projectId`, `name`,
      `slug` (derived or `--slug` flag — TBD), `schema`, `allowedRoleIds`,
      and optional `--accept-origin` values.
- [ ] Prints the returned `signingSecret` once, clearly marked as
      non-repeatable, and never writes it to the config file or any log.
- [ ] Surfaces MCDI's `400`/`409` errors (invalid schema/roles, slug
      conflict) in the CLI's `path`/`code`/`message` shape with `source:
      "mcdi"` — same shape as the local pre-check, different `source`, so the
      two are easy to tell apart and reconcile.

---

### 8. `webhook rotate-secret` never persists or re-displays the secret

**Labels:** `feature`, `webhook`, `security`, `M2`

As a developer rotating a webhook's signing secret, I want the new secret
shown to me exactly once and masked by default, so it can't leak through
shell history or logs by accident.

**Acceptance criteria**
- [ ] `m-forge webhook rotate-secret <id>` calls `POST
      /admin/inbound-webhooks/:id/rotate-secret`.
- [ ] Output is masked by default; `--reveal` is required to print it in
      plain text.
- [ ] Never written to the config file, a log file, or `--json` output
      without `--reveal`.

---

### 9. `webhook roles set` refuses to accept an empty role list

**Labels:** `feature`, `webhook`, `M2`

As a developer, I want `m-forge webhook roles set <id> --roles
<roleId>[,...]` to fail fast locally if I pass an empty list, since MCDI
treats an empty allowed-readers set as effectively deleting the webhook's
read access, not as "allow everyone".

**Acceptance criteria**
- [ ] CLI rejects an empty `--roles` value before making a network call.
- [ ] Calls `PUT /admin/inbound-webhooks/:id/roles` with the full replacement
      set.
- [ ] Surfaces MCDI's `400` (empty set / unknown or foreign roles) clearly.

---

### 10. `webhook list` / `get` / `update` / `delete` round out the CRUD surface

**Labels:** `feature`, `webhook`, `M2`

As a developer, I want the remaining basic CRUD commands so I can manage
webhooks day-to-day without leaving the terminal.

**Acceptance criteria**
- [ ] `m-forge webhook list [--project <project-id>]` → `GET
      /admin/inbound-webhooks[?projectId=]`.
- [ ] `m-forge webhook get <id> [--schema-only] [--json]` → `GET
      /admin/inbound-webhooks/:id`.
- [ ] `m-forge webhook update <id> [--schema <path>] [--name <name>]
      [--active|--inactive]` → `PATCH /admin/inbound-webhooks/:id`,
      re-running the local pre-check from issue #5 if `--schema` is given.
- [ ] `m-forge webhook delete <id> [--yes]` → `DELETE
      /admin/inbound-webhooks/:id`; refuses to call the API without `--yes`
      or an interactive confirmation (deletion also removes all
      submissions — no undo).
