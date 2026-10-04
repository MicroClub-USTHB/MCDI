import { InboundWebhooksService } from './inbound-webhooks.service';
import { validatePayload } from './schema/payload.validator';
import type { FormSchema } from './schema/form-schema.types';

const VALID: FormSchema = {
  version: 1,
  steps: [
    {
      key: 'identity',
      title: 'Who are you?',
      fields: [
        { key: 'firstname', type: 'string', required: true, maxLength: 80 },
        {
          key: 'status',
          type: 'enum',
          required: true,
          options: [{ value: 'student' }, { value: 'professional' }],
        },
        {
          key: 'university',
          type: 'string',
          required: true,
          condition: { op: 'eq', field: 'identity.status', value: 'student' },
        },
      ],
    },
  ],
};

describe('InboundWebhooksService.previewSchema', () => {
  let audit: { insert: jest.Mock };
  let redis: { setIfAbsent: jest.Mock; incr: jest.Mock; delete: jest.Mock };
  let service: InboundWebhooksService;

  beforeEach(() => {
    // Any repository call fails the test: a preview must never read or write.
    const repository = new Proxy(
      {},
      {
        get: (_target, name) => () => {
          throw new Error(`repository.${String(name)} was called`);
        },
      },
    );
    audit = { insert: jest.fn() };
    redis = { setIfAbsent: jest.fn(), incr: jest.fn(), delete: jest.fn() };
    service = new InboundWebhooksService(
      repository as never,
      audit as never,
      redis as never,
      {
        get: (name: string, fallback?: unknown) =>
          name === 'app.baseUrl'
            ? 'https://mcdi.example'
            : name === 'app.apiPrefix'
              ? 'api'
              : fallback,
      } as never,
    );
  });

  it('returns every problem with its path, and no docs', () => {
    const result = service.previewSchema({
      schema: {
        version: 1,
        steps: [
          {
            key: 'identity',
            fields: [
              {
                key: 'a',
                type: 'string',
                required: true,
                maxlenght: 5,
              },
              {
                key: 'b',
                type: 'string',
                required: true,
                condition: { op: 'eq', field: 'identity.nope', value: 'x' },
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => [e.path, e.code])).toEqual([
      ['steps[0].fields[0].maxlenght', 'UNKNOWN_PROPERTY'],
      ['steps[0].fields[1].condition.field', 'FORWARD_REFERENCE'],
    ]);
    expect(result).not.toHaveProperty('markdown');
  });

  describe('agrees with create', () => {
    const rejected: [string, Record<string, unknown>][] = [
      ['an unsupported version', { version: 2, steps: [] }],
      [
        'an unknown property and a forward reference',
        {
          version: 1,
          steps: [
            {
              key: 'identity',
              fields: [
                { key: 'a', type: 'string', required: true, maxlenght: 5 },
                {
                  key: 'b',
                  type: 'string',
                  required: true,
                  condition: { op: 'eq', field: 'identity.nope', value: 'x' },
                },
              ],
            },
          ],
        },
      ],
      ['no steps', { version: 1, steps: [] }],
    ];

    it.each(rejected)(
      'reports exactly the errors create throws for %s',
      async (_label, schema) => {
        const preview = service.previewSchema({ schema });
        const created = await service
          .create(
            {
              projectId: 'p',
              name: 'n',
              slug: 'slug-1',
              schema,
            } as never,
            null,
          )
          .catch((error: { getResponse: () => { errors: unknown[] } }) =>
            error.getResponse(),
          );

        expect(preview.ok).toBe(false);
        expect(preview.ok ? [] : preview.errors).toEqual(
          (created as { errors: unknown[] }).errors,
        );
      },
    );
  });

  it('returns the developer docs and an example for a valid schema', () => {
    const result = service.previewSchema({
      schema: VALID,
      name: 'Recruitment 2026',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toContain('# Recruitment 2026');
    expect(result.markdown).toContain('`identity.status`');
    expect(result.markdown).toContain('X-MCDI-Signature');
  });

  it('gives an example payload that passes the schema', () => {
    const result = service.previewSchema({ schema: VALID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const check = validatePayload(VALID, result.examplePayload, {
      rejectUnknownFields: true,
    });
    expect(check.ok ? [] : check.errors).toEqual([]);
    expect(result.examplePayload).toHaveProperty('identity.university');
  });

  it('uses placeholders for what only exists once the webhook is saved', () => {
    const result = service.previewSchema({ schema: VALID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toContain(
      'https://mcdi.example/api/inbound-webhooks/<webhook-id>/submit',
    );
    expect(result.markdown).toContain('_(none recorded)_');
  });

  it('names an unnamed webhook generically', () => {
    const result = service.previewSchema({ schema: VALID });

    expect(result.ok && result.markdown).toContain('# Inbound webhook');
  });

  it('shows the docs for the options the admin chose', () => {
    const unsigned = service.previewSchema({
      schema: VALID,
      requireSignature: false,
    });
    const origins = service.previewSchema({
      schema: VALID,
      acceptedOrigins: ['https://app.microclub.dz'],
    });

    expect(unsigned.ok && unsigned.markdown).not.toContain('X-MCDI-Signature');
    expect(origins.ok && origins.markdown).toContain(
      'https://app.microclub.dz',
    );
  });

  it('stores nothing, audits nothing and touches no cache', () => {
    service.previewSchema({ schema: VALID });
    service.previewSchema({ schema: { version: 2 } });

    expect(audit.insert).not.toHaveBeenCalled();
    expect(redis.setIfAbsent).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.delete).not.toHaveBeenCalled();
  });

  it('answers quickly even when a stored pattern is catastrophic', () => {
    const started = Date.now();

    const result = service.previewSchema({
      schema: {
        version: 1,
        steps: [
          {
            key: 'step',
            fields: [
              { key: 'a', type: 'string', required: true, pattern: '(a+)+$' },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  describe('a schema without steps', () => {
    const FLAT: FormSchema = {
      version: 1,
      fields: [
        { key: 'title', type: 'string', required: true, maxLength: 80 },
        { key: 'seats', type: 'number', required: false, integer: true },
      ],
    };

    it('renders a flat example that the schema accepts, and docs for it', () => {
      const result = service.previewSchema({ schema: FLAT });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Object.keys(result.examplePayload)).toContain('title');
      expect(result.markdown).toContain('flat JSON object');
      expect(
        validatePayload(FLAT, result.examplePayload, {
          rejectUnknownFields: true,
        }).ok,
      ).toBe(true);
    });

    it('reports a problem at its place under fields', () => {
      const result = service.previewSchema({
        schema: { version: 1, fields: [{ key: 'a', type: 'nope' }] },
      });

      expect(result).toEqual({
        ok: false,
        errors: [expect.objectContaining({ path: 'fields[0].type' })],
      });
    });
  });
});
