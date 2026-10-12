---
name: mcdi-cli
description: How to run and work on mcdi-cli, the CLI MCDI system admins use to author FormSchema files and create, update, inspect and delete MCDI Inbound Webhooks (backends defined by a schema). Use this skill whenever the user wants to write or fix a webhook schema, run `mcdi-cli` commands (login, profile, schema init/validate, webhook create/list/get/update/delete, roles set, rotate-secret, secret get), read an mcdi-cli error or exit code, script mcdi-cli in CI, or change the mcdi-cli codebase, even if they only say "the CLI", "the form backend", "the schema" or "the webhook".
---

# mcdi-cli

mcdi-cli is a thin client in front of MCDI's admin API. An admin uses it to
**configure** a webhook: write its schema, create it, pick who can read its
submissions, keep its signing secret. It never sends submissions: a project's
own backend posts signed data to the webhook's submit URL, and MCDI validates
and stores it. MCDI is the authority on everything; mcdi-cli's local checks only
catch mistakes earlier.

Repo map (paths under `apps/cli/` in the MCDI monorepo): `src/commands/*.ts` (command surface and flags), `src/*-flow.ts`
(command logic), `src/mcdi.ts` (one function per MCDI endpoint),
`src/schema/` (local pre-check), `docs/form-schema.md` (the schema language),
`CLAUDE.md` (conventions). Schema rules come from `packages/form-schema`;
the endpoints are in the generated Admin API reference
(`apps/web/src/content/docs/api-reference/admin`).

## Running it

- Installed: `mcdi-cli <command>`.
- From the repo root: `pnpm --filter @mcdi/cli dev -- <command>` (runs `src/`
  with tsx), or `pnpm --filter @mcdi/cli build` then
  `node apps/cli/bin/mcdi-cli.js <command>`.
- If `pnpm` isn't found, `corepack enable` picks the version pinned in the root
  `package.json`.

## Commands

State-changing commands require `--profile` explicitly; there's no implicit
profile for them, so scripts always say which MCDI they touch.

| Command | Notes |
|---|---|
| `login --profile <p> [--base-url <url>]` | Browser Discord OAuth. `--base-url` is needed the first time on a profile. |
| `whoami [--profile <p>] [--json]` | Who the session belongs to. |
| `logout [--profile <p>]` | Invalidates the session. |
| `profile list` / `add <name> --base-url <url>` / `use <name>` / `remove <name> [--yes]` | Named MCDI targets. |
| `config path` / `config show [--profile <p>]` | Config location; profile with secrets redacted. |
| `schema init [path] [--template blank\|recruitment\|workshop\|event\|project-event]` | Starter schema file, from the admin panel's templates. |
| `schema validate <path>` | Offline pre-check, no network. |
| `webhook create <schema> --name <n> --roles <ids> --profile <p> [--project <id>] [--slug <s>] [--accept-origin <o>]... [--reveal]` | Pre-checks, creates, stores the signing secret encrypted. `--roles` takes at least one Discord role id. |
| `webhook list [--project <id>] [--profile <p>]` | ID, name, slug, project, status, submissions. |
| `webhook get <id> [--schema-only] [--json] [--profile <p>]` | One webhook; `--schema-only` prints its live schema. |
| `webhook update <id> --profile <p> [--schema <path>] [--name <n>] [--active\|--inactive]` | A new schema is pre-checked first. |
| `webhook delete <id> --profile <p> [--yes]` | Deletes the webhook **and all its submissions**. |
| `webhook roles set <id> --roles <ids> --profile <p>` | Replaces the reader roles; an empty list is refused. |
| `webhook rotate-secret <id> --profile <p> [--yes] [--reveal]` | New secret; the old one stops working. |
| `webhook secret get [--profile <p>] [--reveal]` | Reads a stored secret back. |

## Exit codes

| Code | Meaning | What to do |
|---|---|---|
| 0 | OK | |
| 1 | Pre-check failed or bad flags | Read the listed errors, fix the file or the flags. Nothing reached MCDI. |
| 2 | MCDI rejected the request | Read MCDI's message; the schema or values break a server rule. |
| 3 | Not logged in / session expired | The user has to run `login` (see below). |
| 4 | Not found | Wrong id, or no stored secret; check `webhook list`. |
| 5 | Unexpected error, or not implemented | Report the message as is. |

## Rules when Claude runs it

Claude's shell has no interactive terminal, and some steps need the user.

- **Login needs the user.** It opens a browser and waits for them to approve on
  Discord. Don't run it yourself; ask the user to run it, e.g. by typing
  `! mcdi-cli login --profile prod --base-url https://<their MCDI>` in Claude
  Code so the output lands in the conversation. Same after an exit 3.
- **No prompts without a terminal.** Where mcdi-cli would ask, it fails with a
  hint instead. So pass `--project <id>` to `webhook create` (find ids with the
  user, or from `webhook list`), and expect `webhook secret get` to fail when a
  profile stores several secrets.
- **Confirm destructive actions with the user first.** `delete` erases every
  submission; `rotate-secret` breaks every integration still signing with the
  old secret, and MCDI never shows a secret twice. Only add `--yes` after the
  user has explicitly agreed to that specific action.
- **Keep secrets out of sight.** Don't add `--reveal` unless the user asks to see
  a secret, and then don't copy it into files, commits, logs or summaries. When
  they want it shown, have them run `mcdi-cli webhook secret get --profile <p>
  --reveal` in their own terminal, not with the `!` prefix: `!` puts the output
  into the conversation, which is what you're avoiding. Never read or decrypt
  `~/.mcdi-cli/config.json` by hand; use `webhook secret get`.
- **Ask which profile.** Never guess between `prod` and `staging`.

## Writing a schema

`docs/form-schema.md` is the full guide; read it before writing anything beyond
a few fields. The loop:

1. `mcdi-cli schema init form.json` (or `--template recruitment` for a fuller
   example).
2. Edit the JSON.
3. `mcdi-cli schema validate form.json`, fix every listed error, repeat until
   `✓ Schema is valid`. Each error line is `path  CODE  message`, where
   `steps[0].fields[1]` is the second field of the first step.
4. Only then `webhook create` or `webhook update --schema`.

What trips people up:

- `version` is `1`, and the schema needs `steps`, each with `key` and `fields`.
- Every field needs `key`, `type` and `required` written out (`true`/`false`).
- Bounded types need their bound: `array` needs `item` and `maxItems`, `files`
  needs `accept`, `maxSizeBytes` and `maxCount`, `file` needs `accept` and
  `maxSizeBytes`, `json` needs `maxBytes`, `enum`/`multi_enum` need `options`
  with unique string `value`s.
- A property the type doesn't have is `UNKNOWN_PROPERTY`, usually a typo.
- A `condition` reads a field declared earlier, by full path
  (`identity.status`), or `./field` for a sibling inside an array item.
- File fields validate, but MCDI has no upload endpoint yet (MCDI #136), so a
  **required** file field means the webhook can't receive submissions. The
  `recruitment` template's `cv` is one; make it optional or drop it.
- MCDI also accepts a flat schema (`fields` without `steps`); mcdi-cli's
  pre-check doesn't yet.

## Changing the code

Follow `CLAUDE.md`. Beyond it:

- Run `pnpm turbo run lint typecheck test build --filter=@mcdi/cli` from the
  repository root before calling a change done.
- Flows take a `deps` object (config path, keys, output, prompts, browser) so
  tests run without MCDI, a keychain or a terminal; keep new code testable that
  way.
- The built-in pre-check is `@mcdi/form-schema`, the API's own validator.
  Change schema rules in `packages/form-schema`, never in the CLI; the CLI
  only adds custom rules on top.
- When a command, flag or output line changes, update `docs/`
  to match: it quotes the CLI's real behavior.
- Repo text, commits and PRs are in English.
