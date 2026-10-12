# m-forge

A developer CLI that authenticates against MCDI (browser-based Discord OAuth)
and manages MCDI Inbound Webhooks from the terminal — pre-checking schemas
locally before anything hits the server.

Full requirements: [`docs/m-forge-CLI-PRD.md`](docs/m-forge-CLI-PRD.md).
Endpoint-level docs: [`docs/endpoints/`](docs/endpoints/). Writing a
backend schema: [`docs/form-schema.md`](docs/form-schema.md). Custom validation
rules: [`docs/custom-rules.md`](docs/custom-rules.md). Working
conventions for contributors: [`CLAUDE.md`](CLAUDE.md). Landing page:
<https://m-forge-cli.vercel.app> (source in [`apps/cli-landing/`](../cli-landing/)).

## Status

Auth (`login`, `logout`, `whoami`, `profile *`, `config *`), `schema init`,
`schema validate` and every `webhook` command are implemented. `schema build`
(the interactive wizard) and `webhook diff` are still stubs. Earlier work is
tracked in the archived
[m-forge issues](https://github.com/MicroClub-USTHB/m-forge/issues).

## Develop

This is the `@mcdi/cli` workspace of the MCDI monorepo. Requires Node >= 22
and pnpm 10 (`corepack enable`). Run from the repository root:

```bash
pnpm install
pnpm --filter @mcdi/cli dev -- --help   # run the CLI from source
pnpm --filter @mcdi/cli build           # bundle to dist/, then `node apps/cli/bin/m-forge.js --help`
pnpm turbo run lint typecheck test --filter=@mcdi/cli
```
