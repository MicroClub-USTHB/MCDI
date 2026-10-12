# mcdi-cli

A developer CLI that lets an MCDI system admin authenticate once (via
browser-based Discord OAuth against MCDI) and then author, validate, create,
update, and inspect MCDI **Inbound Webhooks** from the terminal, instead of
hand-crafting `FormSchema` JSON and calling the admin API with a raw HTTP
client.

Full product requirements: [`docs/mcdi-cli-PRD.md`](docs/mcdi-cli-PRD.md)
(copied from the MCDI monorepo's `docs/`, which remains the source of truth —
re-sync this copy if the PRD changes there).

## Relationship to MCDI

mcdi-cli is a **thin client** in front of MCDI's own API
(`github.com/MicroClub-USTHB/MCDI`). It does not reimplement server-side
validation or own any data — MCDI's Layer 1 (schema-time) and Layer 2
(submission-time) validation remain the final authority. mcdi-cli's local
validation is an offline pre-check only.

Endpoints mcdi-cli depends on are documented per area under
[`docs/endpoints/`](docs/endpoints/):

- [`docs/endpoints/login/`](docs/endpoints/login/) — the admin Discord OAuth
  flow (`mcdi-cli login`/`logout`/`whoami`)
- [`docs/endpoints/webhook/`](docs/endpoints/webhook/) — the
  `/admin/inbound-webhooks` CRUD surface (`mcdi-cli webhook ...`)

These docs are written from the actual MCDI controller source (not just the
PRD's description of it), and call out where MCDI doesn't yet expose what
mcdi-cli needs — see each file's "Gaps for mcdi-cli" section. Treat MCDI's
source as the ground truth if these docs and the running API ever disagree;
re-verify against `MicroClub-USTHB/MCDI` before relying on a documented shape.

## Status

The command surface is mostly scaffolded. `schema init` and `schema validate`
are implemented, including a local validator aligned with MCDI's Layer 1
schema validator. The remaining commands and milestones are tracked in the
PRD:

| Phase | Scope |
|---|---|
| M0 | Done — MCDI's Inbound Webhooks feature is merged to `main` and live in prod |
| M1 | Auth (`login`/`logout`/`whoami`/`profile *`), config file, built-in local validation engine, `schema init`/`validate` |
| M2 | `webhook create`/`get`/`list`/`update`/`delete`, `webhook roles set`, `webhook rotate-secret` |
| M3 | Interactive `schema build` wizard |
| M4 | Custom rule engine, `webhook diff`, `--json` output across all commands |

## Working conventions

- Target users are MCDI system admins only (gated by MCDI's
  `SystemAdminGuard`) — not external integrators. Don't design for a broader
  audience than that.
- mcdi-cli never re-implements MCDI's validation rules as a second source of
  truth; its local "pre-check" only mirrors known server-side rules plus
  house rules, and can only ever be *stricter* than the server, never looser.
- Session tokens and webhook signing secrets are encrypted at rest (OS
  keychain, falling back to a local key file); never write a plaintext token
  or secret to disk unencrypted, to a log, or to `--json` output. MCDI never
  re-issues a signing secret once rotated, so mcdi-cli's encrypted local copy
  is the only retrievable record of it — see `mcdi-cli webhook secret get`.
- Every state-changing command takes `--profile <name>` explicitly — no
  command should rely on hidden local/active-profile state for scripts or CI.
- Config file: `~/.mcdi-cli/config.json` (override via `MCDI_CLI_CONFIG_PATH`),
  mode `0600`.
