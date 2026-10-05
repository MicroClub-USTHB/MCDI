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
    ],
  },
  {
    title: 'API reference',
    description:
      'Every endpoint of the MCDI API, generated from its OpenAPI document so it always matches the code.',
    pages: [
      {
        slug: 'api-reference/admin-settings',
        title: 'Admin Settings',
        description:
          "The admin's own profile and the editable system settings: read them, change them, or reset them to the environment values.",
      },
      {
        slug: 'api-reference/audit',
        title: 'Audit',
        description: 'Read the audit log of administrative actions and export it as CSV.',
      },
      {
        slug: 'api-reference/authentication',
        title: 'Authentication',
        description:
          'Admin login with Discord, and the project login flow: authorize, exchange the code for a session, validate and log out.',
      },
      {
        slug: 'api-reference/authentication-sso',
        title: 'Authentication (SSO)',
        description:
          'The single sign-on entry point and the browser session endpoints. The recommended way to log members in.',
      },
      {
        slug: 'api-reference/channels',
        title: 'Channels',
        description:
          "List a server's channels, read recent messages and send messages, with a project API key or an admin session.",
      },
      {
        slug: 'api-reference/inbound-webhooks-admin',
        title: 'Inbound Webhooks (Admin)',
        description:
          'Create and manage inbound webhooks: schemas and previews, reader roles, settings, signing secrets, docs and deletion.',
      },
      {
        slug: 'api-reference/inbound-webhooks-ingest',
        title: 'Inbound Webhooks (Ingest)',
        description:
          'The endpoint a project calls to send a signed payload to an inbound webhook, with every response it can return.',
      },
      {
        slug: 'api-reference/inbound-webhooks-read',
        title: 'Inbound Webhooks (Read)',
        description:
          'List the inbound webhooks you may read and fetch their submissions, one at a time or in pages.',
      },
      {
        slug: 'api-reference/members',
        title: 'Members',
        description:
          'Look up members by server, role or search, view them across servers, and export a members report.',
      },
      {
        slug: 'api-reference/monitoring',
        title: 'Monitoring',
        description:
          'Recent authentication failures, the system health check and API usage statistics.',
      },
      {
        slug: 'api-reference/permissions',
        title: 'Permissions',
        description:
          'Check what a role may do, add or remove its permissions, preview a change and manage inheritance rules.',
      },
      {
        slug: 'api-reference/projects',
        title: 'Projects',
        description:
          'Register projects, manage their API keys and redirect URIs, and grant or review their access to servers.',
      },
      {
        slug: 'api-reference/servers',
        title: 'Servers',
        description:
          'Register, update, disable, enable and remove the Discord servers MCDI knows about.',
      },
      {
        slug: 'api-reference/statistics',
        title: 'Statistics',
        description:
          'Member statistics: totals, growth over time, role distribution and overlap across servers, with CSV and JSON export.',
      },
      {
        slug: 'api-reference/sync',
        title: 'Sync',
        description:
          'Trigger a full sync of a server, follow its status and read the logs and change details of past syncs.',
      },
      {
        slug: 'api-reference/webhooks',
        title: 'Webhooks',
        description:
          'Create, list and delete the Discord webhooks a project owns, with a project API key or an admin session.',
      },
    ],
  },
  {
    title: 'Build MCDI',
    description:
      'For people who work on MCDI itself: how to contribute and how these docs are written.',
    pages: [
      {
        slug: 'build/contributing',
        title: 'Contributing',
        description:
          'How work gets done on MCDI: issues, branches, pull requests, the checks to run before you push, and how changes are merged.',
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
