# MCDI developer documentation (MDX)

Date: 2026-10-05. Status: design agreed, not yet implemented.

## 1. Goal

Give current and future developers one place to understand MCDI: how to use it from another MicroClub project, and how it is built and run. The site lives at `/docs` in the existing web app and is written in MDX.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Two tracks: **Integrate with MCDI** (developers of other projects) and **Build MCDI** (contributors), sharing a "Start here" section | Both audiences need docs; they need different things. |
| D2 | Docs live **inside `apps/web` at `/docs`**, rendered with plain `@next/mdx` and our own thin shell | No new service or deploy, shares the design tokens, light on a development machine with 8 GB of RAM. Search can be added later without redesign. |
| D3 | The new MDX is the **source of truth**. The files in `docs/` become historical design records with a short "historical" note and are linked for rationale. Only `auth-integration.md` moves into the docs | The old specs are long and partly out of date; publishing them as is would mislead. |
| D4 | API endpoint reference is **generated from OpenAPI into real MDX files**, one page per Swagger group | It cannot drift from the controllers, and it is searchable and styled with the rest of the docs. |
| D5 | `openapi.json` is **exported to a committed file** and the generated MDX is **committed too**; CI re-runs the export and fails on any diff | Reproducible on Vercel with no API running, and API changes show up as readable diffs in PRs. |

## 3. Content structure

About 25 hand-written pages plus 16 generated pages (one per Swagger group).

**Start here**
- What is MCDI: the concepts (projects, servers, roles, sync, identity, webhooks) on one page.
- Quickstart.

**Integrate with MCDI**
- Login with MicroClub (SSO): the flows, the callback and token exchange, migrating an old integration. Moved from `docs/auth-integration.md`.
- API keys and server access: scopes and operations.
- Roles, permissions and inheritance.
- Inbound webhooks, five pages: overview, schemas (steps or flat fields, field types, conditions), signing and sending, reading submissions, errors and limits.
- API reference (generated).
- Conventions: errors and rate limits.

**Build MCDI**
- Architecture: system diagram, modules, request flow, the two auth models.
- Local setup: Docker, environment variables, creating the Discord application, the first admin.
- API guide: anatomy of a module, database and migrations, guards, caching, the Discord sync, adding an endpoint step by step.
- Web guide: feature slices, design tokens, data fetching, adding a page.
- Shared contracts.
- Testing: Jest, Vitest, e2e, MSW.
- Contributing: branch names, pull requests, the checks, the issue flow.
- Deployment and operations, with troubleshooting from real incidents (a corrupt Redis snapshot, memory limits, a port clash between Docker and a host process).
- Decisions: a short log of why things are the way they are.
- Glossary.

## 4. Site architecture

**Content and routing.** Authors write flat files such as `apps/web/src/content/docs/integrate/sso.mdx`, with no frontmatter. One catch-all route, `app/docs/[...slug]/page.tsx`, loads the file for the slug. A typed `nav.ts` is the single source for the sidebar, previous and next links, breadcrumbs, and each page's title and description.

**Shell.** A `/docs` layout with a top bar, a sidebar holding the two tracks (a drawer on phones), a content column of about 70 characters, and an "On this page" outline. The outline reads the page's `h2` and `h3` in the browser, so no custom build plugin is needed. Existing tokens, dark only. No search in the first version.

**MDX components** (`mdx-components.tsx`): headings with anchors (`rehype-slug`), code blocks with a copy button and syntax highlighting, `Callout`, `Steps`, `Tabs` (the existing Radix tabs), `Diagram` (static SVG; the three in `docs/assets` are reused, the rest are hand-authored). No runtime Mermaid.

**Constraint from Next 16.** `@next/mdx` has no frontmatter by default, and with Turbopack remark and rehype plugins can only be named by string with serializable options. Hence: no frontmatter, no custom function plugins. The highlighter choice (leaning `rehype-highlight`, light and styled with our tokens) is confirmed by a spike in PR 1.

**Access.** `/docs` is public. The login middleware's public routes gain `/docs` and `/docs/*`, with tests. The landing page's "Read the docs" button changes from the Swagger URL to `/docs` (one constant, `DOCS_HREF`).

## 5. OpenAPI pipeline

- `pnpm docs:api` runs two steps: the API exports the OpenAPI document to `apps/api/openapi.json`, then a script in `apps/web` turns it into `src/content/docs/api-reference/<group>.mdx`.
- The export builds the Swagger document the same way `main.ts` does (same config, same `additionalProperties: false` patch) but without listening, and without a database or Discord. A spike in PR 2 confirms this works with dummy environment values.
- Each generated page lists, per endpoint: method and path, summary, authentication, parameters, request body and responses with schemas resolved, and an "Open in Swagger" link.
- Both generated artifacts are committed. CI runs `pnpm docs:api` and fails on `git diff`, with the message "API docs are out of date, run pnpm docs:api".
- Adding a Swagger group requires a `nav.ts` entry; the nav test fails until it is added.

## 6. Keeping the docs true

1. The CI freshness check above.
2. Vitest docs tests: nav and files match one to one, every internal link and anchor resolves, every code block names its language, no empty page.
3. A pull request template with a "docs updated, or not needed" checkbox.
4. A pointer in `CLAUDE.md` on where the docs live and how to add a page.
5. Hand-written pages cite the source files they describe, so a reviewer can check a claim against the code.

## 7. Delivery

Five pull requests, each useful alone.

| PR | Contents |
|---|---|
| 1 | Docs engine: MDX pipeline, shell, nav, components, public access, landing link, three seed pages, tests, highlighter spike. |
| 2 | API pipeline: export script, `openapi.json`, generator, the 16 generated pages, the CI check, export spike. |
| 3 | Integrate track: Quickstart, SSO, API keys, roles, inbound webhooks (five pages), conventions. |
| 4 | Build MCDI part 1: architecture, local setup, API guide, contracts. |
| 5 | Build MCDI part 2: web guide, testing, contributing, deployment and operations, decisions, glossary. |

Each hand-written page is drafted from the code as it is today; the maintainers review for intent and accuracy.

## 8. Risks

- **Dev machine memory.** The dev server has run out of memory on this machine before. MDX is compiled per page on demand, so the load should be small, but PR 1 measures it.
- **Spec export without infrastructure.** Booting Nest without a database or Discord might need small changes; PR 2 starts with a spike.
- **Plugin limits under Turbopack.** Covered by the highlighter spike.
- **Volume.** About 25 pages is the bulk of the work; the order puts the integrator track first because the landing page sends visitors there.

## 9. Out of scope

Search (Pagefind can be added later), translations, documentation versioning, a runtime Mermaid renderer, and a "try it" console (Swagger already provides one).
