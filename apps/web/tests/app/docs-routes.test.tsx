import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DocsHome from '@/app/docs/page';
import DocsPage, { generateMetadata, generateStaticParams } from '@/app/docs/[...slug]/page';
import { allDocPages } from '@/features/docs/nav';
import sitemap from '@/app/sitemap';

describe('docs routes', () => {
  it('builds one static page for every page of the nav', () => {
    expect(generateStaticParams()).toEqual(
      allDocPages().map((page) => ({ slug: page.slug.split('/') }))
    );
  });

  it('takes a page title and description from the nav', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ['build', 'contributing'] }),
    });

    expect(metadata.title).toBe('Contributing | Build MCDI');
    expect(metadata.description).toMatch(/issues, branches, pull requests/);
  });

  it('has no metadata for a page that does not exist', async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: ['nope'] }) })
    ).resolves.toEqual({});
  });

  it('answers 404 for a slug outside the nav, without trying to load a file', async () => {
    await expect(
      DocsPage({ params: Promise.resolve({ slug: ['does', 'not-exist'] }) })
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});

describe('docs home', () => {
  it('has one h1 and a link to every page, grouped by section', () => {
    render(<DocsHome />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const page of allDocPages()) {
      const section = screen
        .getByRole('heading', { level: 2, name: page.section })
        .closest('section')!;
      expect(within(section).getByRole('link', { name: page.title })).toHaveAttribute(
        'href',
        `/docs/${page.slug}`
      );
    }
  });
});

describe('sitemap', () => {
  it('lists the landing page, the docs home and every docs page', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain('http://localhost:3002/');
    expect(urls).toContain('http://localhost:3002/docs');
    for (const page of allDocPages()) {
      expect(urls).toContain(`http://localhost:3002/docs/${page.slug}`);
    }
  });
});
