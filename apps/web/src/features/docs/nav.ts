export interface DocPage {
  /** Path below `/docs`, and the file under `src/content/docs` without `.mdx`. */
  slug: string;
  title: string;
  /** Also the page's meta description, so it reads as a search snippet. */
  description: string;
}

export interface DocSection {
  title: string;
  /** Shown on the docs home. */
  description: string;
  pages: DocPage[];
}

export type DocEntry = DocPage & { section: string };

/**
 * The only list of pages. The sidebar, previous and next links, breadcrumbs, titles and
 * descriptions all come from here. A section appears once it has a page, so the sidebar
 * never links to something that does not exist (a test checks nav and files match).
 */
export const DOCS_NAV: DocSection[] = [
  {
    title: 'Start here',
    description: 'What MCDI is and the few concepts everything else builds on.',
    pages: [
      {
        slug: 'start-here/what-is-mcdi',
        title: 'What is MCDI',
        description:
          'The idea behind MCDI and the handful of concepts, projects, servers, roles, sync and webhooks, that everything else builds on.',
      },
      {
        slug: 'start-here/quickstart',
        title: 'Quickstart',
        description:
          'Go from nothing to a first successful call to the MCDI API with a project key, and learn what a 401 or a 403 means.',
      },
    ],
  },
  {
    title: 'Integrate with MCDI',
    description:
      'For developers of MicroClub projects: sign members in, use your API key, check permissions and receive data through inbound webhooks.',
    pages: [
      {
        slug: 'integrate/sso',
        title: 'Login with MicroClub',
        description:
          'Sign members in with MCDI: the two entry points, the callback, the code exchange, sessions, refresh, logout and migrating an old integration.',
      },
      {
        slug: 'integrate/api-keys',
        title: 'API keys and server access',
        description:
          'How a project authenticates with its API key, how an admin grants access per server, and what each 401 and 403 means.',
      },
      {
        slug: 'integrate/roles-and-permissions',
        title: 'Roles, permissions and inheritance',
        description:
          'How Discord roles become permissions, how inheritance reaches other servers, how to check them, and how fresh an answer is.',
      },
      {
        slug: 'integrate/inbound-webhooks/overview',
        title: 'Inbound webhooks: overview',
        description:
          'What an inbound webhook is, why there is one per kind of data, who creates it, and how it works from creation to reading.',
      },
      {
        slug: 'integrate/inbound-webhooks/schemas',
        title: 'Inbound webhooks: schemas',
        description:
          'Everything a webhook schema can contain: steps or flat fields, every field type and its limits, conditions, defaults and templates.',
      },
      {
        slug: 'integrate/inbound-webhooks/signing-and-sending',
        title: 'Inbound webhooks: signing and sending',
        description:
          'Sign and send a submission with Node, Python or curl: the signature, replay protection, the origin allowlist and the rate limit.',
      },
      {
        slug: 'integrate/inbound-webhooks/reading-submissions',
        title: 'Inbound webhooks: reading submissions',
        description:
          'Who can read what a webhook received, the list and detail endpoints, filters, paging and why a refusal is a 404.',
      },
      {
        slug: 'integrate/inbound-webhooks/errors-and-limits',
        title: 'Inbound webhooks: errors and limits',
        description:
          'Every status the submit endpoint returns, the 422 body that lists all schema problems, each error code and the limits.',
      },
      {
        slug: 'integrate/conventions',
        title: 'Conventions: errors and rate limits',
        description:
          'The rules shared by the whole API: the error shape, per-endpoint rate limits, CORS, paging, identifiers and times.',
      },
    ],
  },
  {
    title: 'Project API',
    description:
      'For developers of MicroClub projects: log members in, check permissions, use channels and webhooks, and send data to inbound webhooks.',
    pages: [
      {
        slug: 'api-reference/project/overview',
        title: 'Project API overview',
        description:
          'How a project calls MCDI: how to authenticate and every endpoint at a glance, grouped by area.',
      },
      {
        slug: 'api-reference/project/authentication',
        title: 'Authentication',
        description:
          "Start a login, exchange the code for a session token, validate or end a session, and manage a member's own sessions.",
      },
      {
        slug: 'api-reference/project/authentication-sso',
        title: 'Authentication (SSO)',
        description:
          'The single sign-on entry point and the browser session endpoints. The recommended way to log members in.',
      },
      {
        slug: 'api-reference/project/channels',
        title: 'Channels',
        description:
          "List a server's channels, read recent messages and send a message to a channel, with a project API key.",
      },
      {
        slug: 'api-reference/project/inbound-webhooks-ingest',
        title: 'Inbound Webhooks (Ingest)',
        description:
          'The endpoint a project calls to send a signed payload to an inbound webhook, with every response it can return.',
      },
      {
        slug: 'api-reference/project/members',
        title: 'Members',
        description:
          "Search members, fetch one by Discord ID, and get a member's effective permissions on a server.",
      },
      {
        slug: 'api-reference/project/permissions',
        title: 'Permissions',
        description:
          "Check one permission or many at once for a member, and get the member's full resolved permissions.",
      },
      {
        slug: 'api-reference/project/webhooks',
        title: 'Webhooks',
        description:
          'Create, update, execute and delete the Discord webhooks a project owns, with a project API key.',
      },
    ],
  },
  {
    title: 'Admin API',
    description:
      'What the admin dashboard uses. These endpoints need an admin session and are not meant for projects.',
    pages: [
      {
        slug: 'api-reference/admin/overview',
        title: 'Admin API overview',
        description:
          'How the admin dashboard talks to MCDI: the admin session it needs and every endpoint at a glance, grouped by area.',
      },
      {
        slug: 'api-reference/admin/admin-settings',
        title: 'Admin Settings',
        description:
          "The admin's own profile and the editable system settings: read them, change them, or reset them to the environment values.",
      },
      {
        slug: 'api-reference/admin/audit',
        title: 'Audit',
        description: 'Read the audit log of administrative actions and export it as CSV.',
      },
      {
        slug: 'api-reference/admin/authentication',
        title: 'Authentication',
        description:
          "Admin login with Discord, the signed-in admin's profile, logout, and the session cleanup job.",
      },
      {
        slug: 'api-reference/admin/channels',
        title: 'Channels',
        description:
          "List a server's channels, see a channel's details and read its recent messages, with an admin session.",
      },
      {
        slug: 'api-reference/admin/inbound-webhooks-admin',
        title: 'Inbound Webhooks (Admin)',
        description:
          'Create and manage inbound webhooks: schemas and previews, reader roles, settings, signing secrets, docs and deletion.',
      },
      {
        slug: 'api-reference/admin/inbound-webhooks-read',
        title: 'Inbound Webhooks (Read)',
        description:
          'List the inbound webhooks you may read and fetch their submissions, one at a time or in pages.',
      },
      {
        slug: 'api-reference/admin/members',
        title: 'Members',
        description:
          'List members by server, role or search, see one across servers, and export a members report.',
      },
      {
        slug: 'api-reference/admin/monitoring',
        title: 'Monitoring',
        description:
          'Recent authentication failures, the system health check and API usage statistics.',
      },
      {
        slug: 'api-reference/admin/permissions',
        title: 'Permissions',
        description:
          "Preview and change a role's permissions and manage the inheritance rules, with an admin session.",
      },
      {
        slug: 'api-reference/admin/projects',
        title: 'Projects',
        description:
          'Register projects, manage their API keys and redirect URIs, and grant or review their access to servers.',
      },
      {
        slug: 'api-reference/admin/servers',
        title: 'Servers',
        description:
          'Register, update, disable, enable and remove the Discord servers MCDI knows about.',
      },
      {
        slug: 'api-reference/admin/statistics',
        title: 'Statistics',
        description:
          'Member statistics: totals, growth over time, role distribution and overlap across servers, with CSV and JSON export.',
      },
      {
        slug: 'api-reference/admin/sync',
        title: 'Sync',
        description:
          'Trigger a full sync of a server, follow its status and read the logs and change details of past syncs.',
      },
      {
        slug: 'api-reference/admin/webhooks',
        title: 'Webhooks',
        description:
          'List, inspect and delete the Discord webhooks of any project, with an admin session.',
      },
    ],
  },
  {
    title: 'Build MCDI',
    description:
      'For people who work on MCDI itself: how to contribute and how these docs are written.',
    pages: [
      {
        slug: 'build/architecture',
        title: 'Architecture',
        description:
          'How MCDI fits together: the repository, a request through the API, how callers authenticate, where data lives and how Discord stays in sync.',
      },
      {
        slug: 'build/local-setup',
        title: 'Local setup',
        description:
          'Run MCDI on your machine: Docker or host, the Discord application, signing in as the first admin, the database commands and every environment variable.',
      },
      {
        slug: 'build/api-guide',
        title: 'API guide',
        description:
          'How the API is built and how to add an endpoint, step by step, with a real feature as the worked example.',
      },
      {
        slug: 'build/web-guide',
        title: 'Web guide',
        description:
          'How the admin panel is built: feature slices, the design system, data fetching, who gets in, and how to add a page step by step.',
      },
      {
        slug: 'build/contracts',
        title: 'Shared contracts',
        description:
          'Why @mcdi/contracts is compiled, what belongs in it, how to rebuild it and the tests that keep it equal to the validator.',
      },
      {
        slug: 'build/testing',
        title: 'Testing',
        description:
          'How MCDI is tested: unit, end to end and browser tests, the exact commands, the throwaway database warning, and what CI runs.',
      },
      {
        slug: 'build/contributing',
        title: 'Contributing',
        description:
          'How work gets done on MCDI: issues, branches, pull requests, the checks to run before you push, and how changes are merged.',
      },
      {
        slug: 'build/operations',
        title: 'Deployment and operations',
        description:
          'How MCDI runs in production, what stops it from booting on purpose, how to read its health, and troubleshooting from real incidents.',
      },
      {
        slug: 'build/decisions',
        title: 'Decisions',
        description:
          'A short log of why MCDI is the way it is: context, decision, consequences and the pull request behind each choice.',
      },
      {
        slug: 'build/glossary',
        title: 'Glossary',
        description:
          'The words MCDI uses, from API key and boot sync to reader role, replay protection and submission, with links to the pages that explain them.',
      },
      {
        slug: 'build/writing-docs',
        title: 'Writing these docs',
        description:
          'How to add or change a documentation page: where files live, the nav entry, the available components and the style rules.',
      },
    ],
  },
];

export function allDocPages(): DocEntry[] {
  return DOCS_NAV.flatMap((section) =>
    section.pages.map((page) => ({ ...page, section: section.title }))
  );
}

export function findDoc(slug: string): DocEntry | null {
  return allDocPages().find((page) => page.slug === slug) ?? null;
}

export function docNeighbours(slug: string): { prev: DocEntry | null; next: DocEntry | null } {
  const pages = allDocPages();
  const index = pages.findIndex((page) => page.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return { prev: pages[index - 1] ?? null, next: pages[index + 1] ?? null };
}
