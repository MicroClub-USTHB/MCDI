# mcid-cli

The MCID command-line client. It authenticates against MCID (browser-based
Discord OAuth) and manages MCID Inbound Webhooks from the terminal,
pre-checking schemas locally before anything hits the server.

The MVP covers Inbound Webhooks only; the CLI is meant to grow to cover the
rest of MCID's admin features.

Writing a backend schema: [`docs/form-schema.md`](docs/form-schema.md). Custom
validation rules: [`docs/custom-rules.md`](docs/custom-rules.md). Working
conventions for contributors: [`CLAUDE.md`](CLAUDE.md).

## Install

Requires Node.js 22 or newer.

```bash
npm install --global mcid-cli
mcid-cli --help
```

The package installs two commands, `mcid-cli` and its shorter alias `mcid`. Both
run the same program. Without installing: `npx mcid-cli --help`.

## Quick start

```bash
# Point a profile at your MCID instance and log in with Discord
mcid-cli login --profile prod --base-url https://mcid.example.com

# Write a schema and check it offline, with the same validator MCID runs
mcid-cli schema init form.json --template recruitment
mcid-cli schema validate form.json

# Create the webhook; its signing secret is stored encrypted on this machine
mcid-cli webhook create form.json --name "Club signup" \
  --roles 123456789012345678 --profile prod

mcid-cli webhook list --profile prod
mcid-cli webhook secret get club-signup --profile prod --reveal
```

Run `mcid-cli <command> --help` for every flag. Exit codes: `0` success, `1`
local pre-check failed, `2` MCID rejected the request, `3` not logged in or not
allowed, `4` not found, `5` unexpected or network error, `64` invalid command line.

## Where it keeps things

- The config file is `~/.mcid-cli/config.json` (mode `0600`). Set
  `MCID_CLI_CONFIG_PATH` to use another file; the key file and global custom
  rules then live next to it.
- Session tokens and webhook signing secrets are encrypted with AES-256-GCM.
  The key is kept in the OS keychain; when no keychain is reachable, it is kept
  in a `0600` key file next to the config, with a warning each time it is used.
- MCID shows a webhook's signing secret only once, when it is created or
  rotated. mcid-cli's encrypted copy is the only one you can read back, with
  `mcid-cli webhook secret get`.

## Develop

This is the `mcid-cli` workspace of the MCID monorepo. Requires Node >= 22
and pnpm 10 (`corepack enable`). Run from the repository root:

```bash
pnpm install
pnpm --filter mcid-cli dev -- --help   # run the CLI from source
pnpm --filter mcid-cli build           # bundle to dist/, then `node apps/cli/bin/mcid-cli.js --help`
pnpm turbo run lint typecheck test --filter=mcid-cli
```

## Release

The package is published to npm as `mcid-cli`. Workspace packages
(`@mcid/form-schema`, `@mcid/contracts`) are bundled into `dist/`, so the
published package depends only on `commander` and `@napi-rs/keyring`. Bump
`version`, then from the repository root:

```bash
pnpm --filter mcid-cli publish --dry-run   # check the tarball
pnpm --filter mcid-cli publish             # runs lint, typecheck, tests and the build first
```
