import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

import { generateApiPages, groupSlug } from '@/features/docs/api-reference/generate';
import type { OpenApiSpec } from '@/features/docs/api-reference/types';

const SPEC: OpenApiSpec = {
  tags: [
    {
      name: 'Things',
      description: 'Things you can manage — admin only. Uses <b>bold</b> and {braces}.',
    },
  ],
  paths: {
    '/api/things/{id}': {
      get: {
        operationId: 'ThingsController_get',
        summary: 'Get a thing',
        description: 'Returns one thing.\n# Not a heading\n    indented like code',
        tags: ['Things'],
        security: [{ 'session-token': [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'verbose',
            in: 'query',
            required: false,
            description: 'Show a | pipe and <tags>',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          '200': {
            description: 'The thing.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ThingDto' } } },
          },
          '404': { description: 'No such thing.' },
        },
      },
      delete: {
        operationId: 'ThingsController_remove',
        summary: 'Delete a thing',
        tags: ['Things'],
        security: [{ 'session-token': [] }],
        responses: { '204': { description: 'Deleted.' } },
      },
    },
    '/api/things': {
      post: {
        operationId: 'ThingsController_create',
        summary: 'Create a thing',
        tags: ['Things'],
        security: [{ 'api-key': [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateThingDto' } },
          },
        },
        responses: {
          '201': {
            description: 'Created.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ThingDto' } } },
          },
        },
      },
      get: {
        operationId: 'ThingsController_list',
        summary: 'List things',
        tags: ['Things'],
        responses: {
          '200': {
            description: 'All things.',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ThingDto' } },
              },
            },
          },
        },
      },
    },
    '/api/things/special': {
      get: {
        operationId: 'ThingsController_special',
        summary: 'A special thing',
        // a controller tag first, then the more specific one set on the method
        tags: ['Things', 'Special'],
        responses: { '200': { description: 'Special.' } },
      },
    },
    '/api/health': {
      get: {
        operationId: 'HealthController_check',
        summary: 'Health',
        tags: ['Monitoring'],
        responses: { '200': { description: 'Fine.' } },
      },
    },
  },
  components: {
    schemas: {
      CreateThingDto: {
        type: 'object',
        required: ['name', 'kind'],
        properties: {
          name: { type: 'string', description: 'The name.' },
          kind: { type: 'string', enum: ['small', 'large'] },
          tags: { type: 'array', items: { type: 'string' } },
          parent: {
            allOf: [{ $ref: '#/components/schemas/ThingDto' }],
            description: 'Parent thing.',
          },
          note: { type: 'string', nullable: true },
          created: { type: 'string', format: 'date-time' },
          attributes: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      ThingDto: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' }, parent: { $ref: '#/components/schemas/ParentDto' } },
      },
      ParentDto: {
        type: 'object',
        properties: { thing: { $ref: '#/components/schemas/ThingDto' } },
      },
    },
  },
};

const pageFor = (slug: string, spec = SPEC) =>
  generateApiPages(spec).find((page) => page.slug === slug)!.content;

describe('groupSlug', () => {
  it.each([
    ['Things', 'things'],
    ['Authentication (SSO)', 'authentication-sso'],
    ['Inbound Webhooks (Admin)', 'inbound-webhooks-admin'],
    ['Admin Settings', 'admin-settings'],
  ])('turns %j into %j', (name, slug) => {
    expect(groupSlug(name)).toBe(slug);
  });
});

describe('generateApiPages', () => {
  it('makes one page per group, in alphabetical order', () => {
    expect(generateApiPages(SPEC).map((page) => [page.group, page.slug])).toEqual([
      ['Monitoring', 'monitoring'],
      ['Special', 'special'],
      ['Things', 'things'],
    ]);
  });

  it('puts an operation on exactly one page, with a link to it in Swagger', () => {
    const all = generateApiPages(SPEC)
      .map((page) => page.content)
      .join('\n');

    for (const id of [
      'ThingsController_get',
      'ThingsController_remove',
      'ThingsController_create',
      'ThingsController_list',
      'HealthController_check',
    ]) {
      expect(all.match(new RegExp(`operationId="${id}"`, 'g'))).toHaveLength(1);
    }
    expect(pageFor('things')).toContain(
      '<SwaggerLink tag="Things" operationId="ThingsController_get" />'
    );
  });

  it('files an operation with two tags under the more specific one, the last', () => {
    expect(pageFor('special')).toContain('## A special thing');
    expect(pageFor('things')).not.toContain('A special thing');
    expect(pageFor('special')).toContain(
      '<SwaggerLink tag="Special" operationId="ThingsController_special" />'
    );
  });

  it('lists the endpoints by path, then by method', () => {
    const things = pageFor('things');
    const order = ['List things', 'Create a thing', 'Get a thing', 'Delete a thing'].map((title) =>
      things.indexOf(`## ${title}`)
    );

    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index >= 0)).toBe(true);
  });

  it('shows the method and path of each endpoint', () => {
    expect(pageFor('things')).toContain('<Endpoint method="GET" path="/api/things/{id}" />');
    expect(pageFor('things')).toContain('<Endpoint method="POST" path="/api/things" />');
  });

  it('says how each endpoint authenticates', () => {
    const things = pageFor('things');

    expect(things).toMatch(/Get a thing[\s\S]*?\*\*Authentication:\*\* Admin session token/);
    expect(things).toMatch(/Create a thing[\s\S]*?\*\*Authentication:\*\* Project API key/);
    expect(things).toMatch(/List things[\s\S]*?\*\*Authentication:\*\* None/);
  });

  it('tabulates parameters with where they go, their type, and whether they are required', () => {
    const things = pageFor('things');

    expect(things).toContain('| `id` | path | `string` | yes |');
    expect(things).toContain('| `verbose` | query | `boolean` | no |');
  });

  it('describes properties: required, enums, arrays, formats, nullable, maps and references', () => {
    const things = pageFor('things');

    expect(things).toContain('| `name` | `string` | yes | The name. |');
    expect(things).toContain('| `kind` | `"small" or "large"` | yes |');
    expect(things).toContain('| `tags` | `array of string` | no |');
    expect(things).toContain('| `created` | `string (date-time)` | no |');
    expect(things).toContain('| `note` | `string or null` | no |');
    expect(things).toContain('| `attributes` | `map of string` | no |');
    expect(things).toContain('| `parent` | `ThingDto` | no | Parent thing. |');
  });

  it('lists the responses with their status', () => {
    const things = pageFor('things');

    expect(things).toContain('| `200` | The thing. | `ThingDto` |');
    expect(things).toContain('| `404` | No such thing. |');
    expect(things).toContain('| `200` | All things. | `array of ThingDto` |');
  });

  it('describes every schema a page uses once, following references, and survives a cycle', () => {
    const things = pageFor('things');

    for (const name of ['CreateThingDto', 'ThingDto', 'ParentDto']) {
      expect(things.match(new RegExp(`^### ${name} schema$`, 'gm'))).toHaveLength(1);
    }
    expect(pageFor('monitoring')).not.toContain('## Schemas');
  });

  it('links a request body to its schema section', () => {
    expect(pageFor('things')).toContain('[CreateThingDto schema](#createthingdto-schema)');
  });

  it('has no h1, no em or en dashes, no code fences, and ends by naming its source', () => {
    for (const page of generateApiPages(SPEC)) {
      expect(page.content).not.toMatch(/^# /m);
      expect(page.content).not.toMatch(/[–—]/);
      expect(page.content).not.toContain('```');
      expect(page.content.trimEnd().split('\n').at(-1)).toBe('Source: `apps/api/openapi.json`.');
    }
  });

  it('turns text that would break MDX into plain text, so every page compiles', async () => {
    for (const page of generateApiPages(SPEC)) {
      await expect(compile(page.content, { remarkPlugins: [remarkGfm] })).resolves.toBeDefined();
    }
    const things = pageFor('things');
    expect(things).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(things).toContain('&#123;braces&#125;');
    expect(things).toContain('\\# Not a heading');
    expect(things).toContain('Show a \\| pipe and &lt;tags&gt;');
    expect(things).not.toMatch(/^ {4}indented/m);
  });

  it('writes the same pages whatever order the spec lists things in', () => {
    const shuffled: OpenApiSpec = {
      ...SPEC,
      paths: Object.fromEntries(
        Object.entries(SPEC.paths)
          .reverse()
          .map(([path, item]) => [path, Object.fromEntries(Object.entries(item).reverse())])
      ),
      components: {
        schemas: Object.fromEntries(Object.entries(SPEC.components!.schemas!).reverse()),
      },
    };

    expect(generateApiPages(shuffled)).toEqual(generateApiPages(SPEC));
  });

  it('starts with a notice that the file is generated', () => {
    expect(pageFor('things')).toMatch(/^\{\/\* Generated by pnpm docs:api/);
  });
});
