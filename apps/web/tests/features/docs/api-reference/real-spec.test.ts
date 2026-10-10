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

function filesBelow(dir: string, prefix = ''): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesBelow(path.join(dir, entry.name), `${prefix}${entry.name}/`)
        : entry.name.endsWith('.mdx')
          ? [`${prefix}${entry.name}`]
          : []
    );
}

const operationIds = Object.values(spec.paths).flatMap((item) =>
  Object.values(item).map((operation) => operation.operationId)
);

describe('the API reference, against the committed openapi.json', () => {
  it('has a nav entry for every generated page, group pages titled after their group', () => {
    const navEntries = allDocPages().filter((page) => page.slug.startsWith('api-reference/'));

    const titled = (title: string, group: string) => (group === 'Overview' ? '*' : title);

    expect(navEntries.map((page) => page.slug).sort()).toEqual(
      pages.map((page) => `api-reference/${page.slug}`).sort()
    );
    for (const generated of pages) {
      const entry = navEntries.find((page) => page.slug === `api-reference/${generated.slug}`)!;
      expect(titled(entry.title, generated.group)).toBe(titled(generated.group, generated.group));
    }
  });

  it(`has exactly the generated pages on disk, none missing or left over: ${STALE}`, () => {
    const onDisk = filesBelow(OUT_DIR).sort();

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
      expect(page.slug).toBe(`${page.audience}/${groupSlug(page.group)}`);
      expect(page.slug).toMatch(/^(project|admin)\/[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('puts every operation that takes a project API key in the project API, and none of them in the admin API', () => {
    const project = pages
      .filter((page) => page.audience === 'project')
      .map((page) => page.content)
      .join('\n');
    const admin = pages
      .filter((page) => page.audience === 'admin')
      .map((page) => page.content)
      .join('\n');

    const withApiKey = Object.values(spec.paths).flatMap((item) =>
      Object.values(item).filter((operation) =>
        operation.security?.some((requirement) => 'api-key' in requirement)
      )
    );
    expect(withApiKey.length).toBeGreaterThan(15);
    for (const operation of withApiKey) {
      expect(project, operation.operationId).toContain(`operationId="${operation.operationId}"`);
      expect(admin, operation.operationId).not.toContain(`operationId="${operation.operationId}"`);
    }
  });

  it("puts a member's own session endpoints with the project API, next to the login", () => {
    const project = pages.find((page) => page.slug === 'project/authentication')!.content;

    expect(project).toContain('<Endpoint method="GET" path="/api/auth/sessions" />');
    expect(project).toContain('<Endpoint method="POST" path="/api/auth/token/refresh" />');
    const admin = pages.find((page) => page.slug === 'admin/authentication')!.content;
    expect(admin).toContain('<Endpoint method="GET" path="/api/auth/admin/me" />');
    expect(admin).not.toContain('/api/auth/sessions');
  });

  it('has an overview per audience that lists every one of its endpoints', () => {
    for (const audience of ['project', 'admin'] as const) {
      const overview = pages.find((page) => page.slug === `${audience}/overview`)!.content;
      const groupPages = pages.filter(
        (page) => page.audience === audience && page.group !== 'Overview'
      );
      const endpointsOnGroupPages = groupPages
        .map((page) => (page.content.match(/<Endpoint /g) ?? []).length)
        .reduce((a, b) => a + b, 0);

      expect((overview.match(/^\| `(GET|POST|PUT|PATCH|DELETE)` \|/gm) ?? []).length).toBe(
        endpointsOnGroupPages
      );
      expect(overview).toContain(
        `${endpointsOnGroupPages} endpoints in ${groupPages.length} groups`
      );
    }
  });

  it('keeps the two audiences together as the whole API', () => {
    const total = pages
      .filter((page) => page.group !== 'Overview')
      .map((page) => (page.content.match(/<Endpoint /g) ?? []).length)
      .reduce((a, b) => a + b, 0);

    expect(total).toBe(operationIds.length);
  });
});
