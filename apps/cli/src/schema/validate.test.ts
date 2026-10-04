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
