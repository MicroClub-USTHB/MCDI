# mcdi-cli

A developer CLI that lets an MCDI admin authenticate once (via
browser-based Discord OAuth against MCDI) and then author, validate, create,
update, and inspect MCDI **Inbound Webhooks** from the terminal, instead of
hand-crafting `FormSchema` JSON and calling the admin API with a raw HTTP
client.

mcdi-cli is the command-line client for MCDI. The MVP covers Inbound
Webhooks only (login, schema authoring and pre-check, webhook management); it
is meant to grow to cover the rest of MCDI's admin features over time.

This is the `mcdi-cli` workspace of the MCDI monorepo (`apps/cli`). Run
scripts from the repository root, e.g.
`pnpm turbo run lint typecheck test --filter=mcdi-cli`.

The original product requirements are a historical record in
[`docs/mcdi-cli-PRD.md`](../../docs/mcdi-cli-PRD.md) at the repository root.

## Relationship to MCDI

mcdi-cli is a **thin client** in front of MCDI's own API (`apps/api` in this
monorepo). It owns no data. It validates a schema locally with
`@mcdi/form-schema`, the same Layer 1 validator the API runs, so the local
pre-check can never disagree with the server; Layer 2 (submission-time)
validation stays in the API. The endpoints it calls are documented in the
generated Admin API reference (`apps/web/src/content/docs/api-reference/admin`).

## Status

The MVP covers Inbound Webhooks: auth (`login`/`logout`/`whoami`/`profile *`/
`config *`), `schema init`/`validate` with custom rules, and every `webhook`
command. Other MCDI features come later as new command groups.

## Working conventions

- Target users are MCDI admins (the admin endpoints are gated by MCDI's
  `AdminAccessGuard` and each admin's permission levels), not external
  integrators. Don't design for a broader audience than that.
- mcdi-cli never re-implements MCDI's rules. Schema rules live in
  `packages/form-schema` and are changed there; the CLI only adds custom
  (house) rules on top, so its pre-check can only ever be *stricter* than the
  server, never looser.
- Session tokens and webhook signing secrets are encrypted at rest (OS
  keychain, falling back to a local key file); never write a plaintext token
  or secret to disk unencrypted, to a log, or to `--json` output. MCDI never
  re-issues a signing secret once rotated, so mcdi-cli's encrypted local copy
  is the only retrievable record of it — see `mcdi-cli webhook secret get`.
- Every state-changing command takes `--profile <name>` explicitly — no
  command should rely on hidden local/active-profile state for scripts or CI.
- Config file: `~/.mcdi-cli/config.json` (override via `MCDI_CLI_CONFIG_PATH`),
  mode `0600`.
