/**
 * Turns `apps/api/openapi.json` into one MDX page per Swagger group under
 * `src/content/docs/api-reference`. Run with `pnpm docs:api` from the repository root (which
 * exports the spec first) or `pnpm --filter @mcdi/web run docs:api` to use the committed spec.
 */
import fs from 'node:fs';
import path from 'node:path';

import { generateApiPages } from '../src/features/docs/api-reference/generate';
import type { OpenApiSpec } from '../src/features/docs/api-reference/types';

const spec = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../api/openapi.json'), 'utf8')
) as OpenApiSpec;
const outDir = path.resolve(__dirname, '../src/content/docs/api-reference');

fs.mkdirSync(outDir, { recursive: true });
const pages = generateApiPages(spec);

for (const page of pages) {
  fs.writeFileSync(path.join(outDir, `${page.slug}.mdx`), page.content);
}

// A group that no longer exists in the API must not leave its page behind.
const wanted = new Set(pages.map((page) => `${page.slug}.mdx`));
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith('.mdx') && !wanted.has(file)) {
    fs.rmSync(path.join(outDir, file));
    console.log(`removed ${file}`);
  }
}

console.log(`api-reference: ${pages.length} pages written`);
