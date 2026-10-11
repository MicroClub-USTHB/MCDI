# m-forge landing page

The landing page for the m-forge CLI: what it does, a four-step quickstart and the command
reference. It's a standalone Next.js app that lives next to the CLI and shares nothing with it
at build time.

Built with [mcoli-ui](https://mcoli-ui.microclub.info), MicroClub's component library, on its
**Primary** theme, with light and dark modes.

## Develop

Requires Node >= 22 and pnpm 10 (`corepack enable`, or `npx pnpm@10.33.2 …`).

```bash
cd landing-page
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts:

```bash
pnpm build        # production build
pnpm start        # serve the production build
pnpm typecheck
pnpm lint
```

## Deploy

Live at <https://m-forge-cli.vercel.app>. Every push to `main` that touches `landing-page/`
deploys it to Vercel through `.github/workflows/deploy-landing.yml`; CLI-only pushes don't. To
redeploy by hand, run that workflow from the repo's Actions tab.

The workflow builds with the Vercel CLI rather than Vercel's GitHub app, and needs three repo
secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.

Set `SITE_URL` on the Vercel project (Production, type **Config**, not Secret: secrets aren't
passed to the build) to the public address of the site. Share previews (the Open Graph image
from `src/app/opengraph-image.tsx`) need absolute URLs; without it they point at
`http://localhost:3000`.

## Layout

```
src/
  app/
    layout.tsx              root layout: fonts, theme, header, footer, toaster
    page.tsx                the page, section by section
    globals.css             mcoli-ui theme tokens (written by `mcoli-ui init`)
    landing.css             the one scroll animation (a short fade-up)
    opengraph-image.tsx     1200x630 share image
  components/
    landing/                one file per section, plus shared primitives
    layout/                 site header and footer
    theme/                  light/dark provider and toggle
    ui/                     mcoli-ui components (copied in by `mcoli-ui add`)
  lib/site.ts               URLs, nav links, install command
```

## mcoli-ui components

Components are copied into `src/components/ui/` by the mcoli-ui CLI, so they're plain source
you can edit. To add one:

```bash
pnpm dlx mcoli-ui@latest add mc-<name>
```

Two local changes to the copied components are worth knowing about before re-adding them
(re-adding overwrites the file):

- `mc-tabs.tsx` adds `McTabsPanel`, which the registry doesn't ship yet (mcoli-ui issue #124).
- `mc-badge.tsx` has two comments translated to English.

## Content rules

Everything the page shows about the CLI must match the CLI's real behavior: commands, flags,
output lines and exit codes are copied from `../src`. Example values (webhook names, IDs, the
masked secret, `mcdi.example.com`) are placeholders. When a command or its output changes in
the CLI, update `src/components/landing/` to match.
