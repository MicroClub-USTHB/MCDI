# mcdi-cli

The MCDI command-line client. It authenticates against MCDI (browser-based
Discord OAuth) and manages MCDI Inbound Webhooks from the terminal,
pre-checking schemas locally before anything hits the server.

The MVP covers Inbound Webhooks only; the CLI is meant to grow to cover the
rest of MCDI's admin features.

Full requirements: [`docs/mcdi-cli-PRD.md`](docs/mcdi-cli-PRD.md).
Endpoint-level docs: [`docs/endpoints/`](docs/endpoints/). Writing a
backend schema: [`docs/form-schema.md`](docs/form-schema.md). Custom validation
rules: [`docs/custom-rules.md`](docs/custom-rules.md). Working
conventions for contributors: [`CLAUDE.md`](CLAUDE.md).

## Status

Auth (`login`, `logout`, `whoami`, `profile *`, `config *`), `schema init`,
`schema validate` and every `webhook` command are implemented. `schema build`
(the interactive wizard) and `webhook diff` are still stubs.

## Develop

This is the `@mcdi/cli` workspace of the MCDI monorepo. Requires Node >= 22
and pnpm 10 (`corepack enable`). Run from the repository root:

```bash
pnpm install
pnpm --filter @mcdi/cli dev -- --help   # run the CLI from source
pnpm --filter @mcdi/cli build           # bundle to dist/, then `node apps/cli/bin/mcdi-cli.js --help`
pnpm turbo run lint typecheck test --filter=@mcdi/cli
```
