import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

import { extractHeadings } from '@/features/docs/headings';
import { allDocPages, findDoc } from '@/features/docs/nav';

const CONTENT_DIR = path.resolve(__dirname, '../../../src/content/docs');

/** The same plugins next.config.ts gives the real build. */
const PIPELINE = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeSlug, [rehypeHighlight, { detect: false, ignoreMissing: true }]],
} as const;

const pages = allDocPages().map((page) => ({
  slug: page.slug,
  source: fs.readFileSync(path.join(CONTENT_DIR, `${page.slug}.mdx`), 'utf8'),
}));

/** The lines that are prose, with the lines inside code fences set aside. */
function split(source: string) {
  const prose: string[] = [];
  const fences: { info: string; line: number }[] = [];
  let open = false;
  source.split('\n').forEach((line, index) => {
    const marker = line.match(/^\s*```(.*)$/);
    if (marker) {
      if (!open) fences.push({ info: marker[1]!.trim(), line: index + 1 });
      open = !open;
      return;
    }
    if (!open) prose.push(line);
  });
  return { prose, fences };
}

function headingIds(source: string): Set<string> {
  return new Set(extractHeadings(source).map((heading) => heading.id));
}

describe.each(pages)('docs page $slug', ({ source }) => {
  const { prose, fences } = split(source);

  it('is valid MDX', async () => {
    await expect(compile(source, PIPELINE)).resolves.toBeDefined();
  });

  it('turns every markdown table into a real table', async () => {
    const hasTableSyntax = prose.some((line) => /^\s*\|?\s*-{3,}\s*\|/.test(line));
    const output = String(await compile(source, PIPELINE));

    expect(output.includes('_components.table')).toBe(hasTableSyntax);
  });

  it('has no h1, because the page title comes from the nav', () => {
    expect(prose.filter((line) => /^#\s/.test(line))).toEqual([]);
  });

  it('names the language of every code block', () => {
    expect(
      fences.filter((fence) => fence.info === '').map((fence) => `line ${fence.line}`)
    ).toEqual([]);
  });

  it('uses no em or en dashes', () => {
    expect(source.match(/[–—]/g) ?? []).toEqual([]);
  });

  it('ends by naming the files it describes', () => {
    const last = prose.filter((line) => line.trim() !== '').at(-1) ?? '';

    expect(last.startsWith('Source:')).toBe(true);
  });

  it('only links to pages and headings that exist', () => {
    const problems: string[] = [];
    for (const [, target] of prose.join('\n').matchAll(/\]\((\/docs[^)\s]*)\)/g)) {
      const [route, anchor] = target!.split('#');
      const slugPath = route!.replace(/^\/docs\/?/, '');
      if (slugPath === '') continue;
      const page = findDoc(slugPath);
      if (!page) {
        problems.push(`${target}: no such page`);
        continue;
      }
      if (anchor && !headingIds(pages.find((p) => p.slug === page.slug)!.source).has(anchor)) {
        problems.push(`${target}: no such heading`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('keeps in-page anchors pointing at real headings', () => {
    const ids = headingIds(source);
    const missing = [...prose.join('\n').matchAll(/\]\(#([^)\s]+)\)/g)]
      .map((match) => match[1]!)
      .filter((id) => !ids.has(id));

    expect(missing).toEqual([]);
  });
});

describe('MDX pipeline', () => {
  it('uses in the real build the plugins these tests compile with', () => {
    const config = fs.readFileSync(path.resolve(__dirname, '../../../next.config.ts'), 'utf8');

    for (const plugin of ['remark-gfm', 'rehype-slug', 'rehype-highlight']) {
      expect(config, plugin).toContain(`'${plugin}'`);
    }
  });
});
