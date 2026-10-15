# mcid-cli

A developer CLI that lets an MCID admin authenticate once (via
browser-based Discord OAuth against MCID) and then author, validate, create,
update, and inspect MCID **Inbound Webhooks** from the terminal, instead of
hand-crafting `FormSchema` JSON and calling the admin API with a raw HTTP
client.

mcid-cli is the command-line client for MCID. The MVP covers Inbound
Webhooks only (login, schema authoring and pre-check, webhook management); it
is meant to grow to cover the rest of MCID's admin features over time.

This is the `mcid-cli` workspace of the MCID monorepo (`apps/cli`). Run
scripts from the repository root, e.g.
`pnpm turbo run lint typecheck test --filter=mcid-cli`.

The original product requirements are a historical record in
[`docs/mcid-cli-PRD.md`](../../docs/mcid-cli-PRD.md) at the repository root.

## Relationship to MCID

mcid-cli is a **thin client** in front of MCID's own API (`apps/api` in this
monorepo). It owns no data. It validates a schema locally with
`@mcid/form-schema`, the same Layer 1 validator the API runs, so the local
pre-check can never disagree with the server; Layer 2 (submission-time)
validation stays in the API. The endpoints it calls are documented in the
generated Admin API reference (`apps/web/src/content/docs/api-reference/admin`).

## Status

The MVP covers Inbound Webhooks: auth (`login`/`logout`/`whoami`/`profile *`/
`config *`), `schema init`/`validate` with custom rules, and every `webhook`
command. Other MCID features come later as new command groups.

## Working conventions

- Target users are MCID admins (the admin endpoints are gated by MCID's
  `AdminAccessGuard` and each admin's permission levels), not external
  integrators. Don't design for a broader audience than that.
- mcid-cli never re-implements MCID's rules. Schema rules live in
  `packages/form-schema` and are changed there; the CLI only adds custom
  (house) rules on top, so its pre-check can only ever be *stricter* than the
  server, never looser.
- Session tokens and webhook signing secrets are encrypted at rest (OS
  keychain, falling back to a local key file); never write a plaintext token
  or secret to disk unencrypted, to a log, or to `--json` output. MCID never
  re-issues a signing secret once rotated, so mcid-cli's encrypted local copy
  is the only retrievable record of it — see `mcid-cli webhook secret get`.
- Every state-changing command takes `--profile <name>` explicitly — no
  command should rely on hidden local/active-profile state for scripts or CI.
- Config file: `~/.mcid-cli/config.json` (override via `MCID_CLI_CONFIG_PATH`),
  mode `0600`.
