import { validateSchema } from './schema.validator';

const field = (over: Record<string, unknown> = {}) => ({
  key: 'name',
  type: 'string',
  required: true,
  ...over,
});
const schema = (fields: unknown[], over: Record<string, unknown> = {}) => ({
  version: 1,
  steps: [{ key: 'identity', fields, ...over }],
});

const codes = (result: ReturnType<typeof validateSchema>) =>
  result.ok ? [] : result.errors.map((e) => e.code);

describe('validateSchema (Layer 1)', () => {
  it('accepts a minimal single-step schema', () => {
    expect(validateSchema(schema([field()]))).toEqual({ ok: true });
  });

  it('accepts the full worked example from the PRD', () => {
    const result = validateSchema({
      version: 1,
      steps: [
        {
          key: 'identity',
          fields: [
            {
              key: 'firstname',
              type: 'string',
              required: true,
              maxLength: 80,
              trim: true,
            },
            {
              key: 'status',
              type: 'enum',
              required: true,
              options: [{ value: 'student' }, { value: 'pro' }],
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
              condition: {
                op: 'eq',
                field: 'identity.status',
                value: 'student',
              },
            },
            {
              key: 'experience',
              type: 'array',
              required: false,
              maxItems: 10,
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
                  },
                ],
              },
            },
          ],
        },
        {
          key: 'documents',
          fields: [
            {
              key: 'cv',
              type: 'file',
              required: true,
              accept: ['application/pdf'],
              maxSizeBytes: 5242880,
            },
          ],
        },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  describe('structure', () => {
    it('rejects a non-object', () => {
      expect(codes(validateSchema('nope'))).toContain('NOT_AN_OBJECT');
    });
    it('rejects an unsupported version', () => {
      expect(codes(validateSchema({ version: 2, steps: [] }))).toContain(
        'UNSUPPORTED_VERSION',
      );
    });
    it('rejects zero steps', () => {
      expect(codes(validateSchema({ version: 1, steps: [] }))).toContain(
        'NO_STEPS',
      );
    });
    it('rejects a step with no fields', () => {
      expect(
        codes(
          validateSchema({ version: 1, steps: [{ key: 'a', fields: [] }] }),
        ),
      ).toContain('NO_FIELDS');
    });
    it('rejects duplicate step keys', () => {
      const result = validateSchema({
        version: 1,
        steps: [
          { key: 'a', fields: [field()] },
          { key: 'a', fields: [field({ key: 'other' })] },
        ],
      });
      expect(codes(result)).toContain('DUPLICATE_KEY');
    });
  });

  describe('keys and types', () => {
    it('rejects duplicate field keys within a step', () => {
      expect(codes(validateSchema(schema([field(), field()])))).toContain(
        'DUPLICATE_KEY',
      );
    });
    it('rejects an unknown field type', () => {
      expect(
        codes(validateSchema(schema([field({ type: 'quaternion' })]))),
      ).toContain('UNKNOWN_TYPE');
    });
    it('rejects a key that is not a safe identifier', () => {
      expect(
        codes(validateSchema(schema([field({ key: 'first name' })]))),
      ).toContain('INVALID_KEY');
    });
    it('rejects a missing required flag', () => {
      const result = validateSchema(schema([{ key: 'a', type: 'string' }]));
      expect(codes(result)).toContain('MISSING_REQUIRED_FLAG');
    });
  });

  describe('regex safety', () => {
    it('rejects a pattern that does not compile', () => {
      expect(
        codes(validateSchema(schema([field({ pattern: '([a-z' })]))),
      ).toContain('INVALID_PATTERN');
    });
    it('rejects an over-long pattern (ReDoS surface)', () => {
      expect(
        codes(validateSchema(schema([field({ pattern: 'a'.repeat(201) })]))),
      ).toContain('PATTERN_TOO_LONG');
    });
    it('accepts a reasonable pattern', () => {
      expect(
        validateSchema(schema([field({ pattern: '^[A-Z]{2}\\d+$' })])),
      ).toEqual({ ok: true });
    });
  });

  describe('mandatory caps', () => {
    it('rejects an array without maxItems', () => {
      const result = validateSchema(
        schema([{ key: 'xs', type: 'array', required: false, item: field() }]),
      );
      expect(codes(result)).toContain('MISSING_MAX_ITEMS');
    });
    it('rejects a files field without maxCount', () => {
      const result = validateSchema(
        schema([
          {
            key: 'fs',
            type: 'files',
            required: false,
            accept: ['image/png'],
            maxSizeBytes: 10,
          },
        ]),
      );
      expect(codes(result)).toContain('MISSING_MAX_COUNT');
    });
    it('rejects a json field without maxBytes', () => {
      const result = validateSchema(
        schema([{ key: 'blob', type: 'json', required: false }]),
      );
      expect(codes(result)).toContain('MISSING_MAX_BYTES');
    });
    it('rejects an inverted range', () => {
      const result = validateSchema(
        schema([field({ minLength: 10, maxLength: 2 })]),
      );
      expect(codes(result)).toContain('INVALID_RANGE');
    });
  });

  describe('limits', () => {
    it('rejects nesting deeper than the cap', () => {
      let inner: Record<string, unknown> = {
        key: 'leaf',
        type: 'string',
        required: false,
      };
      for (let i = 0; i < 8; i += 1) {
        inner = {
          key: `lvl${i}`,
          type: 'object',
          required: false,
          fields: [inner],
        };
      }
      expect(codes(validateSchema(schema([inner])))).toContain('TOO_DEEP');
    });

    it('rejects a schema with too many nodes', () => {
      const many = Array.from({ length: 250 }, (_, i) =>
        field({ key: `f${i}` }),
      );
      expect(codes(validateSchema(schema(many)))).toContain('TOO_MANY_NODES');
    });
  });

  describe('enums', () => {
    it('rejects an enum with no options', () => {
      expect(
        codes(validateSchema(schema([field({ type: 'enum', options: [] })]))),
      ).toContain('NO_OPTIONS');
    });
    it('rejects duplicate option values', () => {
      const result = validateSchema(
        schema([
          field({ type: 'enum', options: [{ value: 'a' }, { value: 'a' }] }),
        ]),
      );
      expect(codes(result)).toContain('DUPLICATE_OPTION');
    });
  });

  describe('conditions', () => {
    it('rejects an unknown operator', () => {
      const result = validateSchema(
        schema([
          field({ key: 'a' }),
          field({
            key: 'b',
            condition: { op: 'approximately', field: 'identity.a', value: 1 },
          }),
        ]),
      );
      expect(codes(result)).toContain('UNKNOWN_OPERATOR');
    });

    it('accepts a reference to an earlier sibling', () => {
      const result = validateSchema(
        schema([
          field({ key: 'a' }),
          field({
            key: 'b',
            condition: { op: 'eq', field: 'identity.a', value: 'x' },
          }),
        ]),
      );
      expect(result).toEqual({ ok: true });
    });

    it('rejects a forward reference to a later field', () => {
      const result = validateSchema(
        schema([
          field({
            key: 'a',
            condition: { op: 'eq', field: 'identity.b', value: 'x' },
          }),
          field({ key: 'b' }),
        ]),
      );
      expect(codes(result)).toContain('FORWARD_REFERENCE');
    });

    it('rejects a reference to a field that does not exist at all', () => {
      const result = validateSchema(
        schema([
          field({
            key: 'a',
            condition: { op: 'eq', field: 'nowhere.x', value: 1 },
          }),
        ]),
      );
      expect(codes(result)).toContain('FORWARD_REFERENCE');
    });

    it('requires a value for every operator except exists', () => {
      const missing = validateSchema(
        schema([
          field({ key: 'a' }),
          field({ key: 'b', condition: { op: 'eq', field: 'identity.a' } }),
        ]),
      );
      expect(codes(missing)).toContain('MISSING_VALUE');

      const exists = validateSchema(
        schema([
          field({ key: 'a' }),
          field({ key: 'b', condition: { op: 'exists', field: 'identity.a' } }),
        ]),
      );
      expect(exists).toEqual({ ok: true });
    });

    it('requires an array value for "in"', () => {
      const result = validateSchema(
        schema([
          field({ key: 'a' }),
          field({
            key: 'b',
            condition: { op: 'in', field: 'identity.a', value: 'x' },
          }),
        ]),
      );
      expect(codes(result)).toContain('INVALID_VALUE');
    });
  });

  it('reports every error at once, not just the first', () => {
    const result = validateSchema(
      schema([
        field({ key: 'bad key' }),
        { key: 'b', type: 'nope', required: true },
        field({ key: 'c', pattern: '([' }),
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
