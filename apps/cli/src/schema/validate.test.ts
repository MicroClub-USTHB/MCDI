import { describe, expect, it } from 'vitest';
import { getSchemaTemplate, minimalSchema } from './templates.js';
import { validateSchema } from './validate.js';

const validSchema = () => structuredClone(minimalSchema);
const codes = (schema: unknown): string[] => validateSchema(schema).errors.map((error) => error.code);

describe('validateSchema', () => {
  it('accepts the minimal template and recruitment placeholder', () => {
    expect(validateSchema(getSchemaTemplate('minimal')).valid).toBe(true);
    expect(validateSchema(getSchemaTemplate('recruitment')).valid).toBe(true);
  });

  it('reports invalid root, version, steps, steps and fields', () => {
    expect(codes(null)).toContain('INVALID_SCHEMA');
    const badVersion = validSchema();
    badVersion.version = 2;
    expect(codes(badVersion)).toContain('INVALID_VERSION');
    expect(codes({ version: 1, steps: [] })).toContain('INVALID_STEPS');
    expect(codes({ version: 1, steps: [null] })).toContain('INVALID_STEP');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: {} }] })).toContain('INVALID_FIELDS');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [null] }] })).toContain('INVALID_FIELD');
  });

  it('checks field keys, duplicate scopes, and supported types', () => {
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ type: 'string' }] }] })).toContain('INVALID_KEY');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'string' }, { key: 'x', type: 'string' }] }] })).toContain('DUPLICATE_KEY');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'made_up' }] }] })).toContain('UNKNOWN_FIELD_TYPE');
    const object = { key: 'obj', type: 'object', fields: [{ key: 'x', type: 'string' }, { key: 'x', type: 'string' }] };
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [object] }] })).toContain('DUPLICATE_KEY');
  });

  it('requires type-specific limits using the currently assumed property names', () => {
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'array' }] }] })).toContain('MISSING_MAX_ITEMS');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'files' }] }] })).toContain('MISSING_MAX_COUNT');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'json' }] }] })).toContain('MISSING_MAX_BYTES');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'json', maxSizeBytes: 100 }] }] })).toContain('MISSING_MAX_BYTES');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'file' }] }] })).toContain('MISSING_MAX_SIZE_BYTES');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'files', maxCount: 2 }] }] })).toContain('MISSING_MAX_SIZE_BYTES');
  });

  it('rejects invalid and overlong patterns with the backend-shaped code', () => {
    const invalid = { version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'string', pattern: '[' }] }] };
    expect(codes(invalid)).toContain('UNCOMPILABLE_REGEX');
    const long = { version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'string', pattern: 'a'.repeat(201) }] }] };
    expect(codes(long)).toContain('UNCOMPILABLE_REGEX');
    const notString = { version: 1, steps: [{ key: 'one', fields: [{ key: 'x', type: 'string', pattern: 2 }] }] };
    expect(codes(notString)).toContain('INVALID_PATTERN');
  });

  it('accepts depth five and rejects depth six', () => {
    const chain = (depth: number): Record<string, unknown> => {
      let field: Record<string, unknown> = { key: `level_${depth}`, type: 'string' };
      for (let level = depth - 1; level >= 1; level -= 1) {
        field = { key: `level_${level}`, type: 'object', fields: [field] };
      }
      return field;
    };
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [chain(5)] }] })).not.toContain('MAX_DEPTH_EXCEEDED');
    expect(codes({ version: 1, steps: [{ key: 'one', fields: [chain(6)] }] })).toContain('MAX_DEPTH_EXCEEDED');
  });

  it('accepts 200 counted nodes and rejects 201', () => {
    const schemaWithFields = (count: number) => ({
      version: 1,
      steps: [{ key: 'one', fields: Array.from({ length: count }, (_, index) => ({ key: `field_${index}`, type: 'string' })) }],
    });
    expect(codes(schemaWithFields(198))).not.toContain('NODE_LIMIT_EXCEEDED');
    expect(codes(schemaWithFields(199))).toContain('NODE_LIMIT_EXCEEDED');
  });

  it('checks unknown and later-step condition references', () => {
    const unknown = { version: 1, steps: [{ key: 'one', condition: { field: 'missing' }, fields: [{ key: 'x', type: 'string' }] }] };
    expect(codes(unknown)).toContain('UNKNOWN_CONDITION_FIELD');
    expect(validateSchema(unknown).errors[0]?.path).toBe('steps[0].condition.field');
    const later = { version: 1, steps: [
      { key: 'first', condition: { all: [{ fieldKey: 'future' }] }, fields: [{ key: 'first_field', type: 'string' }] },
      { key: 'second', fields: [{ key: 'future', type: 'string' }] },
    ] };
    expect(codes(later)).toContain('LATER_STEP_CONDITION_FIELD');
  });

  it('tags emitted errors as local', () => {
    expect(validateSchema(null).errors[0]?.source).toBe('local');
  });
});
