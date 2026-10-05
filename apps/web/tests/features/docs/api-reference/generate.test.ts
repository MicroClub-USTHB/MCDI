import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

import { generateApiPages, groupSlug } from '@/features/docs/api-reference/generate';
import { extractHeadings } from '@/features/docs/headings';
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
    '/api/auth/authorize': {
      get: {
        operationId: 'AuthController_authorize',
        summary: 'Start a login',
        tags: ['Auth'],
        responses: { '302': { description: 'Redirect.' } },
      },
    },
    '/api/auth/admin/discord': {
      get: {
        operationId: 'AuthController_adminLogin',
        summary: 'Admin login',
        tags: ['Auth'],
        responses: { '302': { description: 'Redirect.' } },
      },
    },
    '/api/auth/cleanup': {
      post: {
        operationId: 'AuthController_cleanup',
        summary: 'Clean up',
        tags: ['Auth'],
        responses: { '200': { description: 'Done.' } },
      },
    },
    '/api/health': {
      get: {
        operationId: 'HealthController_check',
        summary: 'Health',
        tags: ['Monitoring'],
        security: [{ 'session-token': [] }],
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
  it('makes an overview and one page per group for each audience, project first', () => {
    expect(generateApiPages(SPEC).map((page) => [page.audience, page.slug])).toEqual([
      ['project', 'project/overview'],
      ['project', 'project/auth'],
      ['project', 'project/special'],
      ['project', 'project/things'],
      ['admin', 'admin/overview'],
      ['admin', 'admin/auth'],
      ['admin', 'admin/monitoring'],
      ['admin', 'admin/things'],
    ]);
  });

  it('splits a group between the audiences by how each operation authenticates', () => {
    const project = pageFor('project/things');
    const admin = pageFor('admin/things');

    expect(project).toContain('## Create a thing');
    expect(project).toContain('## List things');
    expect(project).not.toContain('## Get a thing');
    expect(admin).toContain('## Get a thing');
    expect(admin).toContain('## Delete a thing');
    expect(admin).not.toContain('## Create a thing');
  });

  it('puts the login flow in the project API and the admin login and the cleanup job in the admin API', () => {
    expect(pageFor('project/auth')).toContain('## Start a login');
    expect(pageFor('project/auth')).not.toContain('## Admin login');
    expect(pageFor('admin/auth')).toContain('## Admin login');
    expect(pageFor('admin/auth')).toContain('## Clean up');
  });

  it('puts an operation on exactly one page, with a link to it in Swagger', () => {
    const all = generateApiPages(SPEC)
      .map((page) => page.content)
      .join('\n');
    const ids = [
      'ThingsController_get',
      'ThingsController_remove',
      'ThingsController_create',
      'ThingsController_list',
      'ThingsController_special',
      'HealthController_check',
      'AuthController_authorize',
      'AuthController_adminLogin',
      'AuthController_cleanup',
    ];

    for (const id of ids) {
      expect(all.match(new RegExp(`operationId="${id}"`, 'g')), id).toHaveLength(1);
    }
    expect(pageFor('admin/things')).toContain(
      '<SwaggerLink tag="Things" operationId="ThingsController_get" />'
    );
  });

  it('files an operation with two tags under the more specific one, the last', () => {
    expect(pageFor('project/special')).toContain('## A special thing');
    expect(pageFor('project/things')).not.toContain('A special thing');
    expect(pageFor('project/special')).toContain(
      '<SwaggerLink tag="Special" operationId="ThingsController_special" />'
    );
  });

  it('lists the endpoints by path, then by method', () => {
    const things = pageFor('project/things');

    expect(things.indexOf('## List things')).toBeGreaterThan(-1);
    expect(things.indexOf('## List things')).toBeLessThan(things.indexOf('## Create a thing'));
    const admin = pageFor('admin/things');
    expect(admin.indexOf('## Get a thing')).toBeLessThan(admin.indexOf('## Delete a thing'));
  });

  it('shows the method and path of each endpoint', () => {
    expect(pageFor('admin/things')).toContain('<Endpoint method="GET" path="/api/things/{id}" />');
    expect(pageFor('project/things')).toContain('<Endpoint method="POST" path="/api/things" />');
  });

  it('says how each endpoint authenticates', () => {
    expect(pageFor('admin/things')).toMatch(
      /Get a thing[\s\S]*?\*\*Authentication:\*\* Admin session token/
    );
    expect(pageFor('project/things')).toMatch(
      /Create a thing[\s\S]*?\*\*Authentication:\*\* Project API key/
    );
    expect(pageFor('project/things')).toMatch(/List things[\s\S]*?\*\*Authentication:\*\* None/);
  });

  it('tabulates parameters with where they go, their type, and whether they are required', () => {
    const admin = pageFor('admin/things');

    expect(admin).toContain('| `id` | path | `string` | yes |');
    expect(admin).toContain('| `verbose` | query | `boolean` | no |');
  });

  it('describes properties: required, enums, arrays, formats, nullable, maps and references', () => {
    const project = pageFor('project/things');

    expect(project).toContain('| `name` | `string` | yes | The name. |');
    expect(project).toContain('| `kind` | `"small" or "large"` | yes |');
    expect(project).toContain('| `tags` | `array of string` | no |');
    expect(project).toContain('| `created` | `string (date-time)` | no |');
    expect(project).toContain('| `note` | `string or null` | no |');
    expect(project).toContain('| `attributes` | `map of string` | no |');
    expect(project).toContain('| `parent` | `ThingDto` | no | Parent thing. |');
  });

  it('lists the responses with their status', () => {
    const admin = pageFor('admin/things');

    expect(admin).toContain('| `200` | The thing. | `ThingDto` |');
    expect(admin).toContain('| `404` | No such thing. |');
    expect(pageFor('project/things')).toContain('| `200` | All things. | `array of ThingDto` |');
  });

  it('describes every schema a page uses once, following references, and survives a cycle', () => {
    const project = pageFor('project/things');

    for (const name of ['CreateThingDto', 'ThingDto', 'ParentDto']) {
      expect(project.match(new RegExp(`^### ${name} schema$`, 'gm'))).toHaveLength(1);
    }
    expect(pageFor('admin/monitoring')).not.toContain('## Schemas');
  });

  it('links a request body to its schema section', () => {
    expect(pageFor('project/things')).toContain('[CreateThingDto schema](#createthingdto-schema)');
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
    const admin = pageFor('admin/things');
    expect(admin).toContain('Show a \\| pipe and &lt;tags&gt;');
    expect(admin).toContain('\\# Not a heading');
    expect(admin).not.toMatch(/^ {4}indented/m);
    expect(pageFor('project/things')).toContain('Things you can manage - admin only.');
    expect(pageFor('project/things')).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(pageFor('project/things')).toContain('&#123;braces&#125;');
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

  it('starts every page with a notice that it is generated', () => {
    for (const page of generateApiPages(SPEC)) {
      expect(page.content).toMatch(/^\{\/\* Generated by pnpm docs:api/);
    }
  });
});

describe('the overviews', () => {
  it('explain who the endpoints are for and how to authenticate', () => {
    expect(pageFor('project/overview')).toContain('`X-API-Key`');
    expect(pageFor('project/overview')).toContain("member's own session");
    expect(pageFor('project/overview')).toContain(
      '[Admin API](/docs/api-reference/admin/overview)'
    );
    expect(pageFor('admin/overview')).toContain('admin session');
    expect(pageFor('admin/overview')).toContain(
      '[Project API](/docs/api-reference/project/overview)'
    );
  });

  it('count the endpoints and list each group with a row per endpoint', () => {
    const project = pageFor('project/overview');

    expect(project).toContain('4 endpoints in 3 groups');
    expect(project).toContain('## Things');
    expect(project).toContain('| Method | Path | Summary |');
    expect(project).toContain(
      '| `POST` | `/api/things` | [Create a thing](/docs/api-reference/project/things#create-a-thing) |'
    );
    expect(pageFor('admin/overview')).toContain(
      '| `GET` | `/api/things/{id}` | [Get a thing](/docs/api-reference/admin/things#get-a-thing) |'
    );
  });

  it('link to headings that exist on the page they point to', () => {
    for (const overview of ['project/overview', 'admin/overview']) {
      for (const [, route, anchor] of pageFor(overview)
        .matchAll(/\]\(\/docs\/api-reference\/([a-z/-]+)#([a-z0-9-]+)\)/g)
        .map((m) => m)) {
        const target = pageFor(route!);
        expect(
          extractHeadings(target).map((heading) => heading.id),
          `${route}#${anchor}`
        ).toContain(anchor);
      }
    }
  });

  it('give two operations with the same summary distinct anchors, as the heading ids will be', () => {
    const spec: OpenApiSpec = {
      paths: {
        '/api/a': {
          get: {
            operationId: 'A_one',
            summary: 'Same title',
            tags: ['G'],
            security: [{ 'api-key': [] }],
            responses: {},
          },
        },
        '/api/b': {
          get: {
            operationId: 'A_two',
            summary: 'Same title',
            tags: ['G'],
            security: [{ 'api-key': [] }],
            responses: {},
          },
        },
      },
    };
    const overview = pageFor('project/overview', spec);

    expect(overview).toContain('(/docs/api-reference/project/g#same-title)');
    expect(overview).toContain('(/docs/api-reference/project/g#same-title-1)');
  });
});
