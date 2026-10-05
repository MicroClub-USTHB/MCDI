# docs

The current developer documentation is not in this folder. It is MDX in `apps/web/src/content/docs`, served by the admin panel app at `/docs` (`http://localhost:3002/docs` when you run it locally). It is checked by tests, and its API reference is generated from the code. Start there:

| To | Read |
| --- | --- |
| Use MCDI from another project | Quickstart, then Integrate with MCDI |
| Run, change or deploy MCDI | Build MCDI: Architecture, Local setup, API guide, Web guide, Testing, Deployment and operations |
| Find an endpoint | The Project API and Admin API reference |
| Know why something is the way it is | Build MCDI: Decisions |
| Add a page | `apps/web/src/content/docs/build/writing-docs.mdx` |

## What is in this folder

The files here are **historical design records**. They explain what was planned and why. They are kept for that reasoning and are no longer updated, so where one disagrees with the developer docs, the developer docs are right.

| File | What it is |
| --- | --- |
| `MCDI-V2-SPECIFICATION.md` | The full V2 specification, written before the work it describes. |
| `specefication_document_mvp.md` | The requirements of the MVP release. |
| `specefication_document_last_version.md` | The architecture direction and the roadmap after the MVP. |
| `database_architecture_mvp.md` | The database as it was at the MVP. The current schema is in `apps/api/src/database/entities`. |
| `MCDI-INBOUND-WEBHOOKS-PRD.md` | The product requirements for inbound webhooks, written before they were built. |
| `specefication_file.md` | An index of the MVP-era files. |
| `auth-integration.md` | The original login integration guide. Its maintained successor is the "Login with MicroClub" page. |
| `assets/` | Diagrams from the original specifications. The current diagrams are in `apps/web/public/docs`. |
