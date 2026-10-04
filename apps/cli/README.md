# m-forge

A developer CLI that authenticates against MCDI (browser-based Discord OAuth)
and manages MCDI Inbound Webhooks from the terminal — pre-checking schemas
locally before anything hits the server.

Full requirements: [`docs/m-forge-CLI-PRD.md`](docs/m-forge-CLI-PRD.md).
Endpoint-level docs: [`docs/endpoints/`](docs/endpoints/). Working
conventions for contributors: [`CLAUDE.md`](CLAUDE.md).

## Status

Command surface is scaffolded as stubs (each prints "not implemented" and
points at its tracking issue); no command does real work yet. Implementation
tracked in [issues](https://github.com/MicroClub-USTHB/m-forge/issues).

## Develop

Requires Node >= 22 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev -- --help     # run the CLI from source
pnpm build              # bundle to dist/, then `node bin/m-forge.js --help`
pnpm typecheck
pnpm lint
pnpm test
```
