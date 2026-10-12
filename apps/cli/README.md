# mcdi-cli

A developer CLI that authenticates against MCDI (browser-based Discord OAuth)
and manages MCDI Inbound Webhooks from the terminal — pre-checking schemas
locally before anything hits the server.

Full requirements: [`docs/mcdi-cli-PRD.md`](docs/mcdi-cli-PRD.md).
Endpoint-level docs: [`docs/endpoints/`](docs/endpoints/). Writing a
backend schema: [`docs/form-schema.md`](docs/form-schema.md). Custom validation
rules: [`docs/custom-rules.md`](docs/custom-rules.md). Working
conventions for contributors: [`CLAUDE.md`](CLAUDE.md).

## Status

The command surface is mostly scaffolded. `schema init` and `schema validate`
are implemented, including an offline pre-check aligned with MCDI's Layer 1
schema validator. Other commands remain tracked in
[issues](https://github.com/MicroClub-USTHB/mcdi-cli/issues).

## Develop

Requires Node >= 22 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev -- --help     # run the CLI from source
pnpm build              # bundle to dist/, then `node bin/mcdi-cli.js --help`
pnpm typecheck
pnpm lint
pnpm test
```
