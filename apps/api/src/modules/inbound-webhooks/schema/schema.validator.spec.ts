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

  describe('constraint shapes', () => {
    const errors = (f: Record<string, unknown>) => {
      const result = validateSchema(schema([f]));
      return result.ok ? [] : result.errors.map((e) => `${e.path} ${e.code}`);
    };
    const at = (name: string) =>
      `steps[0].fields[0].${name} INVALID_CONSTRAINT`;

    it('rejects an email allowlist that is not an array of strings', () => {
      expect(
        errors(field({ type: 'email', allowedDomains: 'usthb.dz' })),
      ).toEqual([at('allowedDomains')]);
      expect(errors(field({ type: 'email', allowedDomains: [1] }))).toEqual([
        at('allowedDomains'),
      ]);
    });

    it('rejects url schemes that are not an array of http/https', () => {
      expect(errors(field({ type: 'url', allowedSchemes: 'https' }))).toEqual([
        at('allowedSchemes'),
      ]);
      expect(errors(field({ type: 'url', allowedSchemes: ['ftp'] }))).toEqual([
        at('allowedSchemes'),
      ]);
    });

    it('rejects a date bound that is not a real date', () => {
      expect(errors(field({ type: 'date', min: 'yesterday' }))).toEqual([
        at('min'),
      ]);
      expect(errors(field({ type: 'date', max: '2026-02-31' }))).toEqual([
        at('max'),
      ]);
      expect(
        errors(field({ type: 'datetime', min: '2026-01-31T09:00:00' })),
      ).toEqual([at('min')]);
    });

    it('rejects date bounds in the wrong order', () => {
      expect(
        codes(
          validateSchema(
            schema([
              field({ type: 'date', min: '2026-02-01', max: '2026-01-01' }),
            ]),
          ),
        ),
      ).toEqual(['INVALID_RANGE']);
    });

    it('rejects lengths, counts and flags of the wrong type', () => {
      expect(errors(field({ maxLength: '5' }))).toEqual([at('maxLength')]);
      expect(errors(field({ minLength: -1 }))).toEqual([at('minLength')]);
      expect(errors(field({ trim: 'yes' }))).toEqual([at('trim')]);
      expect(errors(field({ type: 'text', maxLength: 1.5 }))).toEqual([
        at('maxLength'),
      ]);
      expect(errors(field({ type: 'number', min: '0' }))).toEqual([at('min')]);
      expect(errors(field({ type: 'number', integer: 1 }))).toEqual([
        at('integer'),
      ]);
    });

    it('rejects a property the field type does not have', () => {
      expect(errors(field({ maxlength: 5 }))).toEqual([
        'steps[0].fields[0].maxlength UNKNOWN_PROPERTY',
      ]);
      expect(errors(field({ type: 'boolean', minLength: 5 }))).toEqual([
        'steps[0].fields[0].minLength UNKNOWN_PROPERTY',
      ]);
    });

    it('accepts well-formed constraints on every scalar type', () => {
      const result = validateSchema(
        schema([
          field({ key: 'a', label: 'A', description: 'd', default: 'x' }),
          field({ key: 'b', type: 'text', maxLength: 500 }),
          field({ key: 'c', type: 'number', min: 0, max: 9.5, integer: false }),
          field({ key: 'd', type: 'email', allowedDomains: ['usthb.dz'] }),
          field({ key: 'e', type: 'url', allowedSchemes: ['https'] }),
          field({ key: 'f', type: 'phone', region: 'DZ' }),
          field({
            key: 'g',
            type: 'date',
            min: '2026-01-01',
            max: '2026-12-31',
          }),
          field({ key: 'h', type: 'datetime', min: '2026-01-01T00:00:00Z' }),
        ]),
      );
      expect(result).toEqual({ ok: true });
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

    it('rejects a field whose condition references itself', () => {
      const result = validateSchema(
        schema([
          field({ key: 'a', condition: { op: 'exists', field: 'identity.a' } }),
        ]),
      );
      expect(codes(result)).toEqual(['FORWARD_REFERENCE']);
    });

    describe('./ references to a sibling in the same array item', () => {
      const members = (
        itemFields: unknown[],
        over: Record<string, unknown> = {},
      ) => ({
        key: 'members',
        type: 'array',
        required: true,
        maxItems: 5,
        item: {
          key: 'member',
          type: 'object',
          required: true,
          fields: itemFields,
          ...over,
        },
      });
      const lead = (ref = './role') =>
        field({
          key: 'team',
          condition: { op: 'eq', field: ref, value: 'lead' },
        });

      it('accepts a reference to an earlier sibling', () => {
        const result = validateSchema(
          schema([members([field({ key: 'role' }), lead()])]),
        );
        expect(result).toEqual({ ok: true });
      });

      it('accepts a reference into a nested object of the item', () => {
        const result = validateSchema(
          schema([
            members([
              {
                key: 'address',
                type: 'object',
                required: true,
                fields: [field({ key: 'city' })],
              },
              field({
                key: 'note',
                condition: { op: 'exists', field: './address.city' },
              }),
            ]),
          ]),
        );
        expect(result).toEqual({ ok: true });
      });

      it('accepts it inside and, or and not', () => {
        const result = validateSchema(
          schema([
            members([
              field({ key: 'role' }),
              field({
                key: 'team',
                condition: {
                  op: 'not',
                  of: {
                    op: 'or',
                    of: [
                      { op: 'eq', field: './role', value: 'a' },
                      { op: 'eq', field: './role', value: 'b' },
                    ],
                  },
                },
              }),
            ]),
          ]),
        );
        expect(result).toEqual({ ok: true });
      });

      it('accepts a condition on a field inside a nested object of the item', () => {
        const result = validateSchema(
          schema([
            members([
              field({ key: 'role' }),
              {
                key: 'extra',
                type: 'object',
                required: false,
                fields: [lead()],
              },
            ]),
          ]),
        );
        expect(result).toEqual({ ok: true });
      });

      it('rejects a sibling declared later', () => {
        const result = validateSchema(
          schema([members([lead(), field({ key: 'role' })])]),
        );
        expect(codes(result)).toEqual(['FORWARD_REFERENCE']);
      });

      it('rejects a field referencing itself', () => {
        const result = validateSchema(
          schema([
            members([
              field({
                key: 'role',
                condition: { op: 'exists', field: './role' },
              }),
            ]),
          ]),
        );
        expect(codes(result)).toEqual(['FORWARD_REFERENCE']);
      });

      it('rejects a field the item does not have', () => {
        const result = validateSchema(
          schema([members([field({ key: 'role' }), lead('./nope')])]),
        );
        expect(codes(result)).toEqual(['FORWARD_REFERENCE']);
      });

      it('rejects a reference to a sibling of another array', () => {
        const result = validateSchema(
          schema([
            {
              key: 'a',
              type: 'array',
              required: false,
              maxItems: 3,
              item: {
                key: 'one',
                type: 'object',
                required: true,
                fields: [field({ key: 'only_in_a' })],
              },
            },
            {
              key: 'b',
              type: 'array',
              required: false,
              maxItems: 3,
              item: {
                key: 'two',
                type: 'object',
                required: true,
                fields: [lead('./only_in_a')],
              },
            },
          ]),
        );
        expect(codes(result)).toEqual(['FORWARD_REFERENCE']);
      });

      it('resolves ./ against the nearest array when arrays are nested', () => {
        const inner = {
          key: 'tasks',
          type: 'array',
          required: false,
          maxItems: 3,
          item: {
            key: 'task',
            type: 'object',
            required: true,
            fields: [
              field({ key: 'done' }),
              field({
                key: 'why',
                condition: { op: 'eq', field: './done', value: 'no' },
              }),
            ],
          },
        };
        const result = validateSchema(
          schema([members([field({ key: 'role' }), inner])]),
        );
        expect(result).toEqual({ ok: true });

        // `role` belongs to the outer item, so an inner item can't see it
        const outerFieldFromInner = validateSchema(
          schema([
            members([
              field({ key: 'role' }),
              {
                ...inner,
                item: {
                  ...inner.item,
                  fields: [
                    field({
                      key: 'why',
                      condition: { op: 'eq', field: './role', value: 'x' },
                    }),
                  ],
                },
              },
            ]),
          ]),
        );
        expect(codes(outerFieldFromInner)).toEqual(['FORWARD_REFERENCE']);
      });

      it('rejects ./ outside any array item', () => {
        const result = validateSchema(
          schema([
            field({ key: 'a' }),
            field({
              key: 'b',
              condition: { op: 'eq', field: './a', value: 'x' },
            }),
          ]),
        );
        expect(codes(result)).toEqual(['RELATIVE_REFERENCE_OUTSIDE_ITEM']);
      });

      it('rejects ./ in a step condition', () => {
        const result = validateSchema(
          schema([field({ key: 'a' })], {
            condition: { op: 'eq', field: './a', value: 'x' },
          }),
        );
        expect(codes(result)).toContain('RELATIVE_REFERENCE_OUTSIDE_ITEM');
      });

      it("rejects ./ on the array item's own condition, where there is no item yet", () => {
        const result = validateSchema(
          schema([
            members([field({ key: 'role' })], {
              condition: { op: 'eq', field: './role', value: 'x' },
            }),
          ]),
        );
        expect(codes(result)).toEqual(['RELATIVE_REFERENCE_OUTSIDE_ITEM']);
      });

      it('rejects an empty relative path', () => {
        const result = validateSchema(
          schema([members([field({ key: 'role' }), lead('./')])]),
        );
        expect(codes(result)).toEqual(['INVALID_CONDITION']);
      });

      it('points the old absolute form at the new one', () => {
        const result = validateSchema(
          schema([
            members([
              field({ key: 'role' }),
              lead('identity.members.member.role'),
            ]),
          ]),
        );
        expect(codes(result)).toEqual(['UNRESOLVABLE_REFERENCE']);
        expect(
          result.ok ? '' : result.errors.map((e) => e.message).join(' '),
        ).toContain('./');
      });
    });

    it('rejects a reference into an array, which cannot be resolved', () => {
      const members = {
        key: 'members',
        type: 'array',
        required: true,
        maxItems: 5,
        item: {
          key: 'member',
          type: 'object',
          required: true,
          fields: [
            field({ key: 'role' }),
            field({
              key: 'team',
              condition: {
                op: 'eq',
                field: 'identity.members.member.role',
                value: 'lead',
              },
            }),
          ],
        },
      };
      expect(codes(validateSchema(schema([members])))).toEqual([
        'UNRESOLVABLE_REFERENCE',
      ]);
    });

    it('lets an array item reference a field outside the array', () => {
      const result = validateSchema(
        schema([
          field({ key: 'kind' }),
          {
            key: 'members',
            type: 'array',
            required: true,
            maxItems: 5,
            item: field({
              key: 'member',
              condition: { op: 'eq', field: 'identity.kind', value: 'team' },
            }),
          },
        ]),
      );
      expect(result).toEqual({ ok: true });
    });

    it('still lets a condition test the array itself', () => {
      const result = validateSchema(
        schema([
          {
            key: 'members',
            type: 'array',
            required: false,
            maxItems: 5,
            item: field({ key: 'member' }),
          },
          field({
            key: 'lead',
            condition: { op: 'exists', field: 'identity.members' },
          }),
        ]),
      );
      expect(result).toEqual({ ok: true });
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
