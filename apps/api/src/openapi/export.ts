/**
 * Writes the API's OpenAPI document to `apps/api/openapi.json`, the file the developer docs are
 * generated from. Run it with `pnpm --filter @mcdi/api run openapi:export`, or everything at once
 * with `pnpm docs:api` from the repository root.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildOpenApiDocument } from './build-document';
import { sortKeys } from './sort-keys';

async function main(): Promise<void> {
  const document = await buildOpenApiDocument();
  const target = resolve(__dirname, '../../openapi.json');
  writeFileSync(target, `${JSON.stringify(sortKeys(document), null, 2)}\n`);
  console.log(`OpenAPI document written to ${target}`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
