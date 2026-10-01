import {
  buildExamplePayload,
  describeCondition,
  describeConstraints,
  describeType,
  fieldToJsonSchema,
  renderMarkdown,
  renderOpenApi,
  WebhookDocsInput,
} from './webhook-docs.generator';
import { validatePayload } from '../schema/payload.validator';
import type { Field, FormSchema } from '../schema/form-schema.types';

const schema: FormSchema = {
  version: 1,
  steps: [
    {
      key: 'identity',
      title: 'Who are you?',
      fields: [
        {
          key: 'firstname',
          type: 'string',
          required: true,
          maxLength: 80,
          trim: true,
        },
        {
          key: 'email',
          type: 'email',
          required: true,
          allowedDomains: ['usthb.dz'],
        },
        {
          key: 'status',
          type: 'enum',
          required: true,
          options: [{ value: 'student' }, { value: 'professional' }],
        },
      ],
    },
    {
      key: 'background',
      fields: [
        {
          key: 'university',
          type: 'string',
          required: true,
          condition: { op: 'eq', field: 'identity.status', value: 'student' },
        },
        {
          key: 'experience',
          type: 'array',
          required: false,
          maxItems: 5,
          item: {
            key: 'entry',
            type: 'object',
            required: true,
            fields: [
              { key: 'company', type: 'string', required: true },
              {
                key: 'years',
                type: 'number',
                required: true,
                min: 0,
                max: 60,
                integer: true,
              },
            ],
          },
        },
      ],
    },
  ],
};

const input: WebhookDocsInput = {
  id: 'wh-1',
  name: 'Recruitment 2026',
  slug: 'recruitment-2026',
  schema,
  acceptedOrigins: [],
  requireSignature: true,
  rejectUnknownFields: true,
  isActive: true,
  createdAt: new Date('2026-01-31T00:00:00Z'),
  allowedRoles: [{ roleId: '990000000000200002', roleName: 'Lead' }],
  baseUrl: 'https://mcdi.example/api',
};

describe('buildExamplePayload', () => {
  it('produces a payload that actually passes validation', () => {
    const example = buildExamplePayload(schema);
    const result = validatePayload(schema, example, {
      rejectUnknownFields: true,
    });
    if (!result.ok) {
      throw new Error(
        `example failed validation: ${JSON.stringify(result.errors)}`,
      );
    }
    expect(result.ok).toBe(true);
  });

  it('includes a conditional field when the branch it depends on is chosen', () => {
    const example = buildExamplePayload(schema) as Record<
      string,
      Record<string, unknown>
    >;
    // The first enum option is "student", which activates `university`.
    expect(example.identity.status).toBe('student');
    expect(example.background.university).toBeDefined();
  });

  it('omits a conditional field when the branch is not chosen', () => {
    const flipped: FormSchema = {
      ...schema,
      steps: [
        {
          ...schema.steps[0],
          fields: [
            schema.steps[0].fields[0],
            schema.steps[0].fields[1],
            {
              key: 'status',
              type: 'enum',
              required: true,
              options: [{ value: 'professional' }, { value: 'student' }],
            },
          ],
        },
        schema.steps[1],
      ],
    };
    const example = buildExamplePayload(flipped) as Record<
      string,
      Record<string, unknown>
    >;
    expect(example.identity.status).toBe('professional');
    expect(example.background.university).toBeUndefined();
  });

  it('skips a step whose condition is not met', () => {
    const stepped: FormSchema = {
      ...schema,
      steps: [
        schema.steps[0],
        {
          ...schema.steps[1],
          condition: { op: 'eq', field: 'identity.status', value: 'nobody' },
        },
      ],
    };
    expect(buildExamplePayload(stepped).background).toBeUndefined();
  });
});

describe('describeType / describeConstraints / describeCondition', () => {
  it('describes an array of objects by its element type', () => {
    const field = schema.steps[1].fields[1];
    expect(describeType(field)).toBe('object[]');
  });

  it('spells out constraints in prose', () => {
    expect(describeConstraints(schema.steps[0].fields[0])).toContain(
      'max length 80',
    );
    expect(describeConstraints(schema.steps[0].fields[1])).toContain(
      'usthb.dz',
    );
    expect(describeConstraints(schema.steps[0].fields[2])).toContain(
      '`student`',
    );
  });

  it('renders conditions readably, including boolean combinations', () => {
    expect(describeCondition({ op: 'eq', field: 'a.b', value: 'x' })).toBe(
      '`a.b` is `"x"`',
    );
    expect(describeCondition({ op: 'exists', field: 'a.b' })).toBe(
      '`a.b` is present',
    );
    expect(
      describeCondition({
        op: 'and',
        of: [
          { op: 'eq', field: 'a.b', value: 1 },
          { op: 'not', of: { op: 'exists', field: 'a.c' } },
        ],
      }),
    ).toBe('`a.b` is `1` AND NOT (`a.c` is present)');
  });
});

describe('renderMarkdown', () => {
  const md = renderMarkdown(input);

  it('documents the endpoint with the prefixed base URL', () => {
    expect(md).toContain(
      'https://mcdi.example/api/inbound-webhooks/wh-1/submit',
    );
  });

  it('names every field', () => {
    expect(md).toContain('`firstname`');
    expect(md).toContain('`email`');
    expect(md).toContain('`university`');
  });

  it('documents array element paths as the caller sends them', () => {
    // The item's own schema key ("entry") is not a payload key.
    expect(md).toContain('`experience[].company`');
    expect(md).not.toContain('experience[].entry');
  });

  it('marks a conditional field with the condition that activates it', () => {
    expect(md).toMatch(
      /`university`.*only when `identity\.status` is `"student"`/,
    );
  });

  it('includes signing guidance and both code samples when signing is required', () => {
    expect(md).toContain('X-MCDI-Signature');
    expect(md).toContain('### Node.js');
    expect(md).toContain('### Python');
    expect(md).toContain('createHmac');
  });

  it('omits signing guidance when signing is not required', () => {
    const md2 = renderMarkdown({ ...input, requireSignature: false });
    expect(md2).not.toContain('X-MCDI-Signature');
    expect(md2).toContain('curl');
  });

  it('lists the roles permitted to read submissions', () => {
    expect(md).toContain('**Lead**');
    expect(md).toContain('990000000000200002');
    expect(md).toContain('not** readable with your API key');
  });

  it('warns when the webhook is inactive', () => {
    expect(renderMarkdown({ ...input, isActive: false })).toContain('410');
  });

  it('uses a real field name in the 422 example, not a placeholder', () => {
    expect(md).toContain('"path": "identity.firstname"');
  });
});

describe('renderOpenApi', () => {
  const spec = renderOpenApi(input) as Record<string, any>;
  const body =
    spec.paths['/inbound-webhooks/wh-1/submit'].post.requestBody.content[
      'application/json'
    ];

  it('is a 3.1 document pointing at the prefixed server', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers[0].url).toBe('https://mcdi.example/api');
  });

  it('marks unconditional required fields as required', () => {
    expect(body.schema.properties.identity.required).toEqual(
      expect.arrayContaining(['firstname', 'email', 'status']),
    );
  });

  it('does NOT mark a conditionally-required field as required', () => {
    // `university` is required only on the student branch, which JSON Schema
    // cannot express as an unconditional `required` entry.
    expect(body.schema.properties.background.required ?? []).not.toContain(
      'university',
    );
  });

  it('carries the example payload', () => {
    expect(body.example).toEqual(buildExamplePayload(schema));
  });

  it('declares the signature header when signing is required', () => {
    const params = spec.paths['/inbound-webhooks/wh-1/submit'].post.parameters;
    expect(params[0].name).toBe('X-MCDI-Signature');
    expect(
      renderOpenApi({ ...input, requireSignature: false }) as Record<
        string,
        any
      >,
    ).toHaveProperty('paths');
  });
});

describe('fieldToJsonSchema', () => {
  it('maps an enum to a string with enum values', () => {
    expect(fieldToJsonSchema(schema.steps[0].fields[2])).toMatchObject({
      type: 'string',
      enum: ['student', 'professional'],
    });
  });

  it('maps an integer number field with bounds', () => {
    const years = (schema.steps[1].fields[1] as any).item.fields[1] as Field;
    expect(fieldToJsonSchema(years)).toMatchObject({
      type: 'integer',
      minimum: 0,
      maximum: 60,
    });
  });

  it('maps a file field to a fileId reference', () => {
    const file: Field = {
      key: 'cv',
      type: 'file',
      required: true,
      accept: ['application/pdf'],
      maxSizeBytes: 100,
    };
    expect(fieldToJsonSchema(file)).toMatchObject({
      type: 'object',
      properties: { fileId: { type: 'string' } },
      required: ['fileId'],
    });
  });
});
