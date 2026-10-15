# mcdi-cli

The MCDI command-line client. It authenticates against MCDI (browser-based
Discord OAuth) and manages MCDI Inbound Webhooks from the terminal,
pre-checking schemas locally before anything hits the server.

The MVP covers Inbound Webhooks only; the CLI is meant to grow to cover the
rest of MCDI's admin features.

Writing a backend schema: [`docs/form-schema.md`](docs/form-schema.md). Custom
validation rules: [`docs/custom-rules.md`](docs/custom-rules.md). Working
conventions for contributors: [`CLAUDE.md`](CLAUDE.md).

## Install

Requires Node.js 22 or newer.

```bash
npm install --global mcdi-cli
mcdi-cli --help
```

The package installs two commands, `mcdi-cli` and its shorter alias `mcdi`. Both
run the same program. Without installing: `npx mcdi-cli --help`.

## Quick start

```bash
# Point a profile at your MCDI instance and log in with Discord
mcdi-cli login --profile prod --base-url https://mcdi.example.com

# Write a schema and check it offline, with the same validator MCDI runs
mcdi-cli schema init form.json --template recruitment
mcdi-cli schema validate form.json

# Create the webhook; its signing secret is stored encrypted on this machine
mcdi-cli webhook create form.json --name "Club signup" \
  --roles 123456789012345678 --profile prod

mcdi-cli webhook list --profile prod
mcdi-cli webhook secret get club-signup --profile prod --reveal
```

Run `mcdi-cli <command> --help` for every flag. Exit codes: `0` success, `1`
local pre-check failed, `2` MCDI rejected the request, `3` not logged in or not
allowed, `4` not found, `5` unexpected or network error, `64` invalid command line.

## Where it keeps things

- The config file is `~/.mcdi-cli/config.json` (mode `0600`). Set
  `MCDI_CLI_CONFIG_PATH` to use another file; the key file and global custom
  rules then live next to it.
- Session tokens and webhook signing secrets are encrypted with AES-256-GCM.
  The key is kept in the OS keychain; when no keychain is reachable, it is kept
  in a `0600` key file next to the config, with a warning each time it is used.
- MCDI shows a webhook's signing secret only once, when it is created or
  rotated. mcdi-cli's encrypted copy is the only one you can read back, with
  `mcdi-cli webhook secret get`.

## Develop

This is the `mcdi-cli` workspace of the MCDI monorepo. Requires Node >= 22
and pnpm 10 (`corepack enable`). Run from the repository root:

```bash
pnpm install
pnpm --filter mcdi-cli dev -- --help   # run the CLI from source
pnpm --filter mcdi-cli build           # bundle to dist/, then `node apps/cli/bin/mcdi-cli.js --help`
pnpm turbo run lint typecheck test --filter=mcdi-cli
```

## Release

The package is published to npm as `mcdi-cli`. Workspace packages
(`@mcid/form-schema`, `@mcid/contracts`) are bundled into `dist/`, so the
published package depends only on `commander` and `@napi-rs/keyring`. Bump
`version`, then from the repository root:

```bash
pnpm --filter mcdi-cli publish --dry-run   # check the tarball
pnpm --filter mcdi-cli publish             # runs lint, typecheck, tests and the build first
```
