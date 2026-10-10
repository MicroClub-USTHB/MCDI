import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DOCS_NAV, allDocPages, docNeighbours, findDoc } from '@/features/docs/nav';

const CONTENT_DIR = path.resolve(__dirname, '../../../src/content/docs');

function slugsOnDisk(dir = CONTENT_DIR, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return slugsOnDisk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name.endsWith('.mdx') ? [`${prefix}${entry.name.replace(/\.mdx$/, '')}`] : [];
  });
}

describe('docs navigation', () => {
  it('has a file for every page in the nav, so the sidebar never links to a missing page', () => {
    const onDisk = new Set(slugsOnDisk());

    expect(
      allDocPages()
        .filter((page) => !onDisk.has(page.slug))
        .map((page) => page.slug)
    ).toEqual([]);
  });

  it('is not hidden by .gitignore, so the pages that pass here are the pages that get pushed', () => {
    const ignored = allDocPages().filter(
      (page) =>
        spawnSync('git', ['check-ignore', '-q', path.join(CONTENT_DIR, `${page.slug}.mdx`)])
          .status === 0
    );

    expect(ignored.map((page) => page.slug)).toEqual([]);
  });

  it('has a nav entry for every file, so no page is orphaned', () => {
    const inNav = new Set(allDocPages().map((page) => page.slug));

    expect(slugsOnDisk().filter((slug) => !inNav.has(slug))).toEqual([]);
  });

  it('gives every page one unique slug', () => {
    const slugs = allDocPages().map((page) => page.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(slug))).toBe(true);
  });

  it('gives every page a title and a description that fits a search snippet', () => {
    for (const page of allDocPages()) {
      expect(page.title.trim().length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThanOrEqual(30);
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
  });

  it('starts with Start here and never lists a section that has no page yet', () => {
    expect(DOCS_NAV[0]?.title).toBe('Start here');
    expect(DOCS_NAV.filter((section) => section.pages.length === 0)).toEqual([]);
    expect(new Set(DOCS_NAV.map((section) => section.title)).size).toBe(DOCS_NAV.length);
  });

  it('finds a page by slug, and says nothing for an unknown one', () => {
    const first = allDocPages()[0]!;

    expect(findDoc(first.slug)?.title).toBe(first.title);
    expect(findDoc('does/not-exist')).toBeNull();
  });

  it('walks previous and next across sections, with nothing before the first or after the last', () => {
    const pages = allDocPages();
    const last = pages.at(-1)!;

    expect(docNeighbours(pages[0]!.slug)).toEqual({ prev: null, next: pages[1] ?? null });
    expect(docNeighbours(pages[1]!.slug).prev?.slug).toBe(pages[0]!.slug);
    expect(docNeighbours(last.slug).next).toBeNull();
    expect(docNeighbours('does/not-exist')).toEqual({ prev: null, next: null });
  });

  it('tells which section a page belongs to, for breadcrumbs', () => {
    expect(findDoc('start-here/what-is-mcdi')?.section).toBe('Start here');
  });
});
