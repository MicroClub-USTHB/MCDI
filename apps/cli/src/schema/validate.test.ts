import { describe, expect, it } from 'vitest';
import { getSchemaTemplate, minimalSchema } from './templates.js';
import { validateSchema } from './validate.js';

const field = (overrides: Record<string, unknown> = {}) => ({
  key: 'name', type: 'string', required: true, ...overrides,
});

const schema = (fields: unknown[], stepOverrides: Record<string, unknown> = {}) => ({
  version: 1,
  steps: [{ key: 'identity', fields, ...stepOverrides }],
});

const codes = (value: unknown): string[] => validateSchema(value).errors.map((error) => error.code);

describe('validateSchema (MCDI Layer 1 parity)', () => {
  it('accepts both shipped templates, including MCDI §6.5 worked example', () => {
    expect(validateSchema(getSchemaTemplate('minimal')).valid).toBe(true);
    expect(validateSchema(getSchemaTemplate('recruitment')).valid).toBe(true);
  });

  it('accepts valid MCDI dotted-path conditions and rejects forward references', () => {
    const valid = {
      version: 1,
      steps: [
        { key: 'identity', fields: [field({ key: 'status', type: 'enum', options: [{ value: 'student' }] })] },
        { key: 'background', fields: [field({ key: 'university', condition: { op: 'eq', field: 'identity.status', value: 'student' } })] },
      ],
    };
    expect(validateSchema(valid).valid).toBe(true);

    const forward = schema([
      field({ key: 'a', condition: { op: 'exists', field: 'identity.b' } }),
      field({ key: 'b' }),
    ]);
    expect(codes(forward)).toContain('FORWARD_REFERENCE');
  });

  it('checks schema version, non-empty steps, and step-count limit', () => {
    expect(codes('not an object')).toContain('NOT_AN_OBJECT');
    expect(codes({ version: 2, steps: [{ key: 'one', fields: [field()] }] })).toContain('UNSUPPORTED_VERSION');
    expect(codes({ version: 1, steps: [] })).toContain('NO_STEPS');
    const tooMany = Array.from({ length: 21 }, (_, index) => ({ key: `step_${index}`, fields: [field({ key: `f${index}` })] }));
    expect(codes({ version: 1, steps: tooMany })).toContain('TOO_MANY_STEPS');
  });

  it('checks step keys, duplicate step keys, and non-empty step fields', () => {
    expect(codes({ version: 1, steps: [{ key: 'bad key', fields: [field()] }] })).toContain('INVALID_KEY');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [] }] })).toContain('NO_FIELDS');
    const duplicateSteps = { version: 1, steps: [
      { key: 'one', fields: [field({ key: 'first' })] },
      { key: 'one', fields: [field({ key: 'second' })] },
    ] };
    expect(codes(duplicateSteps)).toContain('DUPLICATE_KEY');
  });

  it('checks field key format, length, duplicates, and type', () => {
    expect(codes(schema([field({ key: 'bad key' })]))).toContain('INVALID_KEY');
    expect(codes(schema([field({ key: 'a'.repeat(65) })]))).toContain('KEY_TOO_LONG');
    expect(codes(schema([field(), field()]))).toContain('DUPLICATE_KEY');
    expect(codes(schema([field({ type: 'not_a_type' })]))).toContain('UNKNOWN_TYPE');
    expect(codes(schema([{ key: 'missing_required', type: 'string' }]))).toContain('MISSING_REQUIRED_FLAG');
  });

  it('rejects unknown field properties and invalid property shapes', () => {
    expect(codes(schema([field({ maxlength: 10 })]))).toContain('UNKNOWN_PROPERTY');
    expect(codes(schema([field({ maxLength: 'ten' })]))).toContain('INVALID_CONSTRAINT');
    expect(codes(schema([field({ type: 'email', allowedDomains: [1] })]))).toContain('INVALID_CONSTRAINT');
    expect(codes(schema([field({ type: 'url', allowedSchemes: ['ftp'] })]))).toContain('INVALID_CONSTRAINT');
  });

  it('checks pattern length and compilability only for string fields', () => {
    expect(codes(schema([field({ pattern: '('.repeat(201) })]))).toContain('PATTERN_TOO_LONG');
    expect(codes(schema([field({ pattern: '[' })]))).toContain('INVALID_PATTERN');
    expect(codes(schema([field({ type: 'number', pattern: '[' })]))).toContain('UNKNOWN_PROPERTY');
  });

  it('requires positive array, file, files, and JSON limits', () => {
    expect(codes(schema([field({ type: 'array', item: field({ key: 'item' }), maxItems: 0 })]))).toContain('MISSING_MAX_ITEMS');
    expect(codes(schema([field({ type: 'array', maxItems: 5 })]))).toContain('MISSING_ITEM');
    expect(codes(schema([field({ type: 'file', accept: ['application/pdf'], maxSizeBytes: -1 })]))).toContain('MISSING_MAX_SIZE');
    expect(codes(schema([field({ type: 'files', accept: ['image/png'], maxSizeBytes: 10, maxCount: 0 })]))).toContain('MISSING_MAX_COUNT');
    expect(codes(schema([field({ type: 'json', maxBytes: 0 })]))).toContain('MISSING_MAX_BYTES');
  });

  it('checks enum options, duplicate values, and ranges', () => {
    expect(codes(schema([field({ type: 'enum', options: [] })]))).toContain('NO_OPTIONS');
    expect(codes(schema([field({ type: 'enum', options: [{ value: 'a' }, { value: 'a' }] })]))).toContain('DUPLICATE_OPTION');
    expect(codes(schema([field({ minLength: 10, maxLength: 2 })]))).toContain('INVALID_RANGE');
    expect(codes(schema([field({ type: 'number', min: 10, max: 2 })]))).toContain('INVALID_RANGE');
  });

  it('requires real dates and timezone-qualified ISO date-times', () => {
    expect(codes(schema([field({ type: 'date', min: 'yesterday' })]))).toContain('INVALID_CONSTRAINT');
    expect(codes(schema([field({ type: 'date', max: '2026-02-31' })]))).toContain('INVALID_CONSTRAINT');
    expect(codes(schema([field({ type: 'datetime', min: '2026-01-31T09:00:00' })]))).toContain('INVALID_CONSTRAINT');
    expect(validateSchema(schema([
      field({ key: 'date', type: 'date', min: '2026-01-01', max: '2026-12-31' }),
      field({ key: 'datetime', type: 'datetime', min: '2026-01-01T00:00:00Z' }),
    ])).valid).toBe(true);
  });

  it('checks object children and their duplicate-key scope', () => {
    const duplicateChildren = field({
      key: 'profile', type: 'object', fields: [field({ key: 'x' }), field({ key: 'x' })],
    });
    expect(codes(schema([duplicateChildren]))).toContain('DUPLICATE_KEY');
    expect(codes(schema([field({ key: 'empty', type: 'object', fields: [] })]))).toContain('NO_FIELDS');
  });

  it('counts only field nodes and enforces depth five', () => {
    const makeFields = (count: number) => Array.from({ length: count }, (_, index) => field({ key: `field_${index}` }));
    expect(codes(schema(makeFields(200)))).not.toContain('TOO_MANY_NODES');
    expect(codes(schema(makeFields(201)))).toContain('TOO_MANY_NODES');

    const nestedField = (depth: number): Record<string, unknown> => {
      let current: Record<string, unknown> = field({ key: `leaf_${depth}` });
      for (let level = depth - 1; level >= 1; level -= 1) {
        current = field({ key: `object_${level}`, type: 'object', fields: [current] });
      }
      return current;
    };
    expect(codes(schema([nestedField(5)]))).not.toContain('TOO_DEEP');
    expect(codes(schema([nestedField(6)]))).toContain('TOO_DEEP');
  });

  it('validates the condition AST and array reference behavior', () => {
    expect(codes(schema([field({ condition: { op: 'unknown', field: 'identity.a' } })]))).toContain('UNKNOWN_OPERATOR');
    expect(codes(schema([field({ condition: { op: 'and', of: [] } })]))).toContain('INVALID_CONDITION');
    expect(codes(schema([field({ condition: { op: 'eq', field: 'identity.a' } })]))).toContain('MISSING_VALUE');
    expect(codes(schema([
      field({ key: 'members', type: 'array', maxItems: 2, item: field({ key: 'member' }) }),
      field({ key: 'role', condition: { op: 'exists', field: 'identity.members.member' } }),
    ]))).toContain('UNRESOLVABLE_REFERENCE');
  });

  it('marks every local error with source local and accepts the minimal template', () => {
    expect(validateSchema(minimalSchema).valid).toBe(true);
    expect(validateSchema(null).errors[0]?.source).toBe('local');
  });
});

describe('validateSchema: complex schema-acceptance edge cases', () => {
  /** An array-of-objects field: `member` is an object with the given child fields. */
  const membersArray = (overrides: Record<string, unknown> = {}, memberFields: unknown[] = []) =>
    field({
      key: 'members',
      type: 'array',
      maxItems: 5,
      item: { key: 'member', type: 'object', required: true, fields: memberFields, ...overrides },
    });

  describe('./ relative conditions inside array items (MCDI ITEM_REF_PREFIX parity)', () => {
    it('accepts a sibling field referencing an earlier field in the same item via ./', () => {
      const valid = schema([
        membersArray({}, [
          field({ key: 'role', type: 'enum', options: [{ value: 'lead' }, { value: 'member' }] }),
          field({ key: 'title', type: 'string', required: false, condition: { op: 'eq', field: './role', value: 'lead' } }),
        ]),
      ]);
      expect(validateSchema(valid).valid).toBe(true);
    });

    it('resolves a nested dotted path relative to the item root (./address.city)', () => {
      const valid = schema([
        membersArray({}, [
          field({ key: 'address', type: 'object', fields: [field({ key: 'city' })] }),
          field({ key: 'isLocal', type: 'boolean', condition: { op: 'eq', field: './address.city', value: 'Algiers' } }),
        ]),
      ]);
      expect(validateSchema(valid).valid).toBe(true);
    });

    it('rejects ./field when it is not declared earlier in the same item (item-local forward reference)', () => {
      const forward = schema([
        membersArray({}, [
          field({ key: 'title', condition: { op: 'eq', field: './role', value: 'lead' } }),
          field({ key: 'role' }),
        ]),
      ]);
      expect(codes(forward)).toContain('FORWARD_REFERENCE');
    });

    it('rejects ./ used outside any array item', () => {
      expect(codes(schema([field({ condition: { op: 'eq', field: './role', value: 'x' } })])))
        .toContain('RELATIVE_REFERENCE_OUTSIDE_ITEM');
    });

    it('rejects ./ on the item root\'s own condition (nothing in the item is declared yet)', () => {
      const rootCondition = schema([
        membersArray({ condition: { op: 'eq', field: './role', value: 'lead' } }, [field({ key: 'role' })]),
      ]);
      expect(codes(rootCondition)).toContain('RELATIVE_REFERENCE_OUTSIDE_ITEM');
    });

    it('rejects a bare "./" with no field name', () => {
      const bare = schema([
        membersArray({}, [
          field({ key: 'role' }),
          field({ key: 'title', condition: { op: 'eq', field: './', value: 'x' } }),
        ]),
      ]);
      expect(codes(bare)).toContain('INVALID_CONDITION');
    });

    it('still rejects an absolute dotted path into an array item, now hinting at ./ as the fix', () => {
      const result = validateSchema(schema([
        membersArray({}, [field({ key: 'role' })]),
        field({ key: 'other', condition: { op: 'exists', field: 'identity.members.member.role' } }),
      ]));
      const err = result.errors.find((e) => e.code === 'UNRESOLVABLE_REFERENCE');
      expect(err?.message).toMatch(/\.\/role/);
    });

    it('scopes ./ to the innermost item when arrays are nested: outer item fields are not visible inside the inner item', () => {
      const nested = schema([
        field({
          key: 'teams',
          type: 'array',
          maxItems: 3,
          item: {
            key: 'team',
            type: 'object',
            required: true,
            fields: [
              field({ key: 'teamName' }),
              field({
                key: 'members',
                type: 'array',
                maxItems: 5,
                item: {
                  key: 'member',
                  type: 'object',
                  required: true,
                  fields: [
                    field({ key: 'role' }),
                    // References the OUTER item's field, not reachable from inside the inner item.
                    field({ key: 'bad', required: false, condition: { op: 'eq', field: './teamName', value: 'x' } }),
                  ],
                },
              }),
            ],
          },
        }),
      ]);
      expect(codes(nested)).toContain('FORWARD_REFERENCE');
    });

    it('restores the outer item scope after a nested array finishes, so the outer item can still reference its own earlier fields', () => {
      const nested = schema([
        field({
          key: 'teams',
          type: 'array',
          maxItems: 3,
          item: {
            key: 'team',
            type: 'object',
            required: true,
            fields: [
              field({ key: 'teamName' }),
              field({
                key: 'members',
                type: 'array',
                maxItems: 5,
                item: { key: 'member', type: 'object', required: true, fields: [field({ key: 'role' })] },
              }),
              // Back in the outer item, after the nested array: ./teamName is still in scope.
              field({ key: 'teamNote', required: false, condition: { op: 'exists', field: './teamName' } }),
            ],
          },
        }),
      ]);
      expect(validateSchema(nested).valid).toBe(true);
    });
  });

  describe('step and field ordering', () => {
    it('allows a field to reference an earlier field declared in the same step (not just an earlier step)', () => {
      const sameStep = schema([
        field({ key: 'status', type: 'enum', options: [{ value: 'yes' }] }),
        field({ key: 'reason', required: false, condition: { op: 'eq', field: 'identity.status', value: 'yes' } }),
      ]);
      expect(validateSchema(sameStep).valid).toBe(true);
    });

    it('rejects a field referencing itself or a later field in the same step', () => {
      const selfRef = schema([field({ key: 'a', condition: { op: 'exists', field: 'identity.a' } })]);
      expect(codes(selfRef)).toContain('FORWARD_REFERENCE');

      const laterRef = schema([
        field({ key: 'a', condition: { op: 'exists', field: 'identity.b' } }),
        field({ key: 'b', required: false }),
      ]);
      expect(codes(laterRef)).toContain('FORWARD_REFERENCE');
    });

    it('rejects a step condition referencing a field declared in a later step', () => {
      const result = {
        version: 1,
        steps: [
          { key: 'a', condition: { op: 'exists', field: 'b.x' }, fields: [field({ key: 'y' })] },
          { key: 'b', fields: [field({ key: 'x' })] },
        ],
      };
      expect(codes(result)).toContain('FORWARD_REFERENCE');
    });
  });

  describe('combined / simultaneous errors', () => {
    it('reports both a missing maxItems and an out-of-order range on the same array field', () => {
      const broken = schema([field({ type: 'array', item: field({ key: 'item' }), minItems: 5, maxItems: -1 })]);
      const result = codes(broken);
      expect(result).toContain('MISSING_MAX_ITEMS');
      expect(result).toContain('INVALID_RANGE');
    });

    it('still counts a too-deep node against the node budget', () => {
      const nestedField = (depth: number): Record<string, unknown> => {
        let current: Record<string, unknown> = field({ key: `leaf_${depth}` });
        for (let level = depth - 1; level >= 1; level -= 1) {
          current = field({ key: `object_${level}`, type: 'object', fields: [current] });
        }
        return current;
      };
      // depth 7 trips TOO_DEEP at the bottom node, but every node on the way down is still counted.
      const result = validateSchema(schema([nestedField(7)]));
      expect(result.errors.map((e) => e.code)).toContain('TOO_DEEP');
    });
  });

  describe('type-specific property scoping', () => {
    it('rejects minCount/maxCount on a `file` field (they only belong to `files`)', () => {
      expect(codes(schema([field({ type: 'file', accept: ['application/pdf'], maxSizeBytes: 10, minCount: 1 })])))
        .toContain('UNKNOWN_PROPERTY');
    });

    it('rejects `options` on a plain `string` field', () => {
      expect(codes(schema([field({ options: [{ value: 'a' }] })]))).toContain('UNKNOWN_PROPERTY');
    });
  });

  describe('condition AST shape', () => {
    it('rejects "not" when `of` is an array instead of a single condition object', () => {
      expect(codes(schema([
        field({ key: 'a', type: 'enum', options: [{ value: 'x' }] }),
        field({ key: 'b', required: false, condition: { op: 'not', of: [{ op: 'exists', field: 'identity.a' }] } }),
      ]))).toContain('INVALID_CONDITION');
    });

    it('accepts deeply nested and/or/not up to the depth limit and rejects beyond it', () => {
      const nestedCondition = (depth: number): Record<string, unknown> => {
        let current: Record<string, unknown> = { op: 'exists', field: 'identity.a' };
        for (let i = 0; i < depth; i += 1) current = { op: 'not', of: current };
        return current;
      };
      const base = [field({ key: 'a', type: 'boolean' })];
      expect(validateSchema(schema([...base, field({ key: 'b', required: false, condition: nestedCondition(5) })])).valid).toBe(true);
      expect(codes(schema([...base, field({ key: 'c', required: false, condition: nestedCondition(6) })])))
        .toContain('CONDITION_TOO_DEEP');
    });
  });

  describe('calendar correctness', () => {
    it('accepts a real leap day and rejects the same date in a non-leap year', () => {
      expect(validateSchema(schema([field({ type: 'date', min: '2024-02-29' })])).valid).toBe(true);
      expect(codes(schema([field({ type: 'date', min: '2023-02-29' })]))).toContain('INVALID_CONSTRAINT');
    });

    it('requires a "T" separator for datetime, rejecting a space even with a valid timezone', () => {
      expect(codes(schema([field({ type: 'datetime', min: '2026-01-01 00:00:00Z' })]))).toContain('INVALID_CONSTRAINT');
      expect(validateSchema(schema([field({ type: 'datetime', min: '2026-01-01T00:00:00+01:00' })])).valid).toBe(true);
    });
  });
});
