import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocPageHeader } from '@/features/docs/components/doc-page-header';
import { DocPager } from '@/features/docs/components/doc-pager';
import { DocsOutline } from '@/features/docs/components/docs-outline';
import { DocsShell } from '@/features/docs/components/docs-shell';
import { DocsSidebar } from '@/features/docs/components/docs-sidebar';
import { API_REFERENCE_HREF } from '@/features/docs/links';
import type { DocHeadingInfo } from '@/features/docs/headings';
import { allDocPages } from '@/features/docs/nav';

const nav = vi.hoisted(() => ({ pathname: '/docs/start-here/what-is-mcdi' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

beforeEach(() => {
  nav.pathname = '/docs/start-here/what-is-mcdi';
});

describe('DocsSidebar', () => {
  it('lists every section and page of the nav', () => {
    render(<DocsSidebar />);

    for (const page of allDocPages()) {
      expect(screen.getByRole('link', { name: page.title })).toHaveAttribute(
        'href',
        `/docs/${page.slug}`
      );
    }
    expect(screen.getByText('Start here')).toBeInTheDocument();
    expect(screen.getByText('Build MCDI')).toBeInTheDocument();
  });

  it('marks the page you are on', () => {
    nav.pathname = '/docs/build/contributing';
    render(<DocsSidebar />);

    expect(screen.getByRole('link', { name: 'Contributing' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'What is MCDI' })).not.toHaveAttribute('aria-current');
  });

  it('tells its parent when a link is followed, so a drawer can close', async () => {
    const onNavigate = vi.fn();
    render(<DocsSidebar onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('link', { name: 'Contributing' }));

    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('DocsShell', () => {
  it('has the top bar links: home, the API reference and the admin sign in', () => {
    render(
      <DocsShell>
        <p>content</p>
      </DocsShell>
    );
    const bar = within(screen.getByRole('banner'));

    expect(bar.getByRole('link', { name: /MCDI/ })).toHaveAttribute('href', '/');
    expect(bar.getByRole('link', { name: 'API reference' })).toHaveAttribute(
      'href',
      API_REFERENCE_HREF
    );
    expect(bar.getByRole('link', { name: 'Admin sign in' })).toHaveAttribute('href', '/login');
  });

  it('lets keyboard users skip to the content', () => {
    render(
      <DocsShell>
        <p>content</p>
      </DocsShell>
    );

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content'
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('opens the navigation as a drawer, closes it on Escape and returns focus to the button', async () => {
    render(
      <DocsShell>
        <p>content</p>
      </DocsShell>
    );
    const open = screen.getByRole('button', { name: 'Open navigation' });

    await userEvent.click(open);
    const drawer = await screen.findByRole('dialog', { name: 'Documentation navigation' });
    expect(within(drawer).getByRole('link', { name: 'Contributing' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(open).toHaveFocus();
  });

  it('keeps the API reference reachable from the drawer, since the top bar drops it on a phone', async () => {
    render(
      <DocsShell>
        <p>content</p>
      </DocsShell>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = await screen.findByRole('dialog');

    expect(within(drawer).getByRole('link', { name: 'API reference' })).toHaveAttribute(
      'href',
      API_REFERENCE_HREF
    );
  });

  it('closes the drawer when a page is chosen', async () => {
    render(
      <DocsShell>
        <p>content</p>
      </DocsShell>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = await screen.findByRole('dialog');

    await userEvent.click(within(drawer).getByRole('link', { name: 'Contributing' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DocPageHeader', () => {
  it('shows the breadcrumbs, the one h1 and the description', () => {
    render(<DocPageHeader slug="build/contributing" />);

    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    expect(crumbs.getByText('Build MCDI')).toBeInTheDocument();
    expect(crumbs.getByText('Contributing')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Contributing' })).toBeInTheDocument();
    expect(screen.getByText(/issues, branches, pull requests/)).toBeInTheDocument();
  });
});

describe('DocPager', () => {
  it('offers the page before and the page after', () => {
    render(<DocPager slug="build/contributing" />);

    expect(screen.getByRole('link', { name: /Previous.*What is MCDI/s })).toHaveAttribute(
      'href',
      '/docs/start-here/what-is-mcdi'
    );
    expect(screen.getByRole('link', { name: /Next.*Writing these docs/s })).toHaveAttribute(
      'href',
      '/docs/build/writing-docs'
    );
  });

  it('has nothing before the first page', () => {
    render(<DocPager slug="start-here/what-is-mcdi" />);

    expect(screen.queryByRole('link', { name: /Previous/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Next/ })).toBeInTheDocument();
  });

  it('has nothing after the last page', () => {
    render(<DocPager slug="build/writing-docs" />);

    expect(screen.queryByRole('link', { name: /Next/ })).toBeNull();
  });
});

describe('DocsOutline', () => {
  let trigger: (entries: Partial<IntersectionObserverEntry>[]) => void;

  beforeEach(() => {
    window.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        trigger = (entries) => callback(entries as IntersectionObserverEntry[], this as never);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds = [];
    } as never;
  });

  const HEADINGS: DocHeadingInfo[] = [
    { id: 'one', text: 'One', level: 2 },
    { id: 'one-a', text: 'One A', level: 3 },
    { id: 'two', text: 'Two', level: 2 },
    { id: 'x', text: 'Skipped', level: 4 },
  ];

  function page(headings: DocHeadingInfo[]) {
    return render(
      <>
        <article id="doc-content">
          {headings.map((heading) => (
            <h2 key={heading.id} id={heading.id}>
              {heading.text}
            </h2>
          ))}
        </article>
        <DocsOutline headings={headings} />
      </>
    );
  }

  it('lists the h2 and h3 headings of the page as links to them', () => {
    page(HEADINGS);
    const outline = within(screen.getByRole('navigation', { name: 'On this page' }));

    expect(outline.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'One',
      'One A',
      'Two',
    ]);
    expect(outline.getByRole('link', { name: 'Two' })).toHaveAttribute('href', '#two');
  });

  it('marks the heading you are reading', () => {
    page(HEADINGS);

    act(() => trigger([{ isIntersecting: true, target: document.getElementById('two')! }]));

    expect(screen.getByRole('link', { name: 'Two' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'One' })).not.toHaveAttribute('aria-current');
  });

  it('stays out of the way on a page with fewer than two headings', () => {
    page([{ id: 'only', text: 'Only', level: 2 }]);

    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
  });
});
