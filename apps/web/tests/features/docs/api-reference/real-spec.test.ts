import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateApiPages, groupSlug } from '@/features/docs/api-reference/generate';
import type { OpenApiSpec } from '@/features/docs/api-reference/types';
import { allDocPages } from '@/features/docs/nav';

const SPEC_PATH = path.resolve(__dirname, '../../../../../api/openapi.json');
const OUT_DIR = path.resolve(__dirname, '../../../../src/content/docs/api-reference');
const STALE = 'run `pnpm docs:api` and commit the result';

const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8')) as OpenApiSpec;
const pages = generateApiPages(spec);

const operationIds = Object.values(spec.paths).flatMap((item) =>
  Object.values(item).map((operation) => operation.operationId)
);

describe('the API reference, against the committed openapi.json', () => {
  it('has a nav entry for every Swagger group, with the group as its title', () => {
    const navEntries = allDocPages().filter((page) => page.slug.startsWith('api-reference/'));

    expect(navEntries.map((page) => [page.slug, page.title]).sort()).toEqual(
      pages.map((page) => [`api-reference/${page.slug}`, page.group]).sort()
    );
  });

  it(`has exactly the generated pages on disk, none missing or left over: ${STALE}`, () => {
    const onDisk = fs
      .readdirSync(OUT_DIR)
      .filter((file) => file.endsWith('.mdx'))
      .sort();

    expect(onDisk).toEqual(pages.map((page) => `${page.slug}.mdx`).sort());
  });

  it(`has pages that match what the spec generates today: ${STALE}`, () => {
    for (const page of pages) {
      const onDisk = fs.readFileSync(path.join(OUT_DIR, `${page.slug}.mdx`), 'utf8');
      expect(onDisk, `${page.slug}.mdx is out of date`).toBe(page.content);
    }
  });

  it('shows every operation of the API on exactly one page', () => {
    const all = pages.map((page) => page.content).join('\n');

    expect(operationIds.length).toBeGreaterThan(100);
    for (const id of operationIds) {
      expect(all.match(new RegExp(`operationId="${id}"`, 'g')), id).toHaveLength(1);
    }
  });

  it('gives each group a slug that is a valid file name and page address', () => {
    for (const page of pages) {
      expect(page.slug).toBe(groupSlug(page.group));
      expect(page.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
