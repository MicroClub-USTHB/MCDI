import type { OpenAPIObject } from '@nestjs/swagger';

import { buildOpenApiDocument } from './build-document';
import { sortKeys } from './sort-keys';

/**
 * Under ts-jest the Nest CLI's Swagger plugin is not applied, so this document carries less
 * detail (property descriptions and types read from the code) than the one `nest build` produces.
 * These tests only check what the plugin does not change. Whether the committed openapi.json is
 * current is checked in CI, from the real build: `pnpm docs:api`, then `git diff`.
 */
describe('buildOpenApiDocument', () => {
  let document: OpenAPIObject;

  // Boots the whole application graph once, with no database, Redis or Discord behind it.
  beforeAll(async () => {
    document = await buildOpenApiDocument();
  }, 60_000);

  const operations = () =>
    Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, { tags?: string[] }>)
        .filter(([method]) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(method),
        )
        .map(([method, operation]) => ({
          path,
          method,
          tags: operation.tags ?? [],
        })),
    );

  it('covers every Swagger group the API has', () => {
    const groups = [
      ...new Set(operations().flatMap((operation) => operation.tags)),
    ].sort();

    expect(groups).toEqual([
      'Admin Access',
      'Admin Settings',
      'Audit',
      'Authentication',
      'Authentication (SSO)',
      'Channels',
      'Inbound Webhooks (Admin)',
      'Inbound Webhooks (Ingest)',
      'Inbound Webhooks (Read)',
      'Members',
      'Monitoring',
      'Permissions',
      'Projects',
      'Servers',
      'Statistics',
      'Sync',
      'Webhooks',
    ]);
  });

  it('puts every operation in a group, so none is lost from the reference', () => {
    expect(
      operations().filter((operation) => operation.tags.length === 0),
    ).toEqual([]);
  });

  it('includes the inbound webhook routes under the API prefix', () => {
    const paths = Object.keys(document.paths);

    expect(paths).toContain('/api/inbound-webhooks/{id}/submit');
    expect(paths).toContain('/api/admin/inbound-webhooks');
    expect(paths).toContain('/api/admin/inbound-webhooks/schema/preview');
  });

  it('forbids extra properties on every request schema that has properties', () => {
    const schemas = Object.values(document.components?.schemas ?? {}) as {
      type?: string;
      properties?: object;
      additionalProperties?: boolean;
    }[];

    const open = schemas.filter(
      (schema) =>
        schema.type === 'object' &&
        schema.properties &&
        schema.additionalProperties !== false,
    );

    expect(open).toEqual([]);
  });

  it('uses a fixed server, so the file is the same on every machine', () => {
    expect(document.servers).toEqual([
      { url: 'http://localhost:3000', description: 'API Server' },
    ]);
  });

  it('gives the same document twice', async () => {
    const again = await buildOpenApiDocument();

    expect(JSON.stringify(sortKeys(again))).toBe(
      JSON.stringify(sortKeys(document)),
    );
  }, 60_000);
});
