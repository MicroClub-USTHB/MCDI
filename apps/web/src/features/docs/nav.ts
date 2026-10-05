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
