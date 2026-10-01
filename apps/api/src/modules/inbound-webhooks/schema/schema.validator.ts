/**
 * Layer 1 — validates a FormSchema itself, at webhook create/update time.
 *
 * Separating this from payload validation is the central design decision:
 * by the time a submission is validated, the schema is known-good, so the
 * hot path never recompiles a regex or re-checks structure.
 */
import {
  Condition,
  Field,
  FIELD_TYPES,
  FormSchema,
  FormStep,
  KEY_PATTERN,
  SCHEMA_LIMITS,
} from './form-schema.types';

export type SchemaError = { path: string; code: string; message: string };

export type SchemaValidationResult =
  { ok: true } | { ok: false; errors: SchemaError[] };

const CONDITION_OPS = new Set([
  'eq',
  'ne',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
  'contains',
  'exists',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class SchemaChecker {
  private readonly errors: SchemaError[] = [];
  private nodeCount = 0;
  /** Field paths declared so far, in declaration order, for condition refs */
  private readonly declared = new Set<string>();

  constructor(private readonly schema: unknown) {}

  run(): SchemaValidationResult {
    const s = this.schema;

    if (!isRecord(s)) {
      return this.fail('', 'NOT_AN_OBJECT', 'Schema must be an object');
    }
    if (s.version !== 1) {
      this.push(
        'version',
        'UNSUPPORTED_VERSION',
        'Only version 1 is supported',
      );
    }
    if (!Array.isArray(s.steps) || s.steps.length === 0) {
      return this.fail(
        'steps',
        'NO_STEPS',
        'Schema must declare at least one step',
      );
    }
    if (s.steps.length > SCHEMA_LIMITS.MAX_STEPS) {
      this.push(
        'steps',
        'TOO_MANY_STEPS',
        `At most ${SCHEMA_LIMITS.MAX_STEPS} steps are allowed`,
      );
    }

    const stepKeys = new Set<string>();
    (s.steps as unknown[]).forEach((rawStep, i) => {
      this.checkStep(rawStep, `steps[${i}]`, stepKeys);
    });

    if (this.nodeCount > SCHEMA_LIMITS.MAX_NODES) {
      this.push(
        '',
        'TOO_MANY_NODES',
        `Schema declares ${this.nodeCount} fields; the limit is ${SCHEMA_LIMITS.MAX_NODES}`,
      );
    }

    return this.errors.length === 0
      ? { ok: true }
      : { ok: false, errors: this.errors };
  }

  private checkStep(raw: unknown, path: string, seen: Set<string>): void {
    if (!isRecord(raw)) {
      this.push(path, 'NOT_AN_OBJECT', 'Step must be an object');
      return;
    }
    const key = raw.key;
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      this.push(
        `${path}.key`,
        'INVALID_KEY',
        'Step key must match [a-zA-Z_][a-zA-Z0-9_]*',
      );
      return;
    }
    if (seen.has(key)) {
      this.push(`${path}.key`, 'DUPLICATE_KEY', `Duplicate step key "${key}"`);
    }
    seen.add(key);

    // A step condition may only reference fields declared in EARLIER steps,
    // which the running `declared` set already reflects.
    if (raw.condition !== undefined) {
      this.checkCondition(raw.condition, `${path}.condition`);
    }

    if (!Array.isArray(raw.fields) || raw.fields.length === 0) {
      this.push(
        `${path}.fields`,
        'NO_FIELDS',
        'Step must declare at least one field',
      );
      return;
    }

    const fieldKeys = new Set<string>();
    (raw.fields as unknown[]).forEach((rawField, i) => {
      this.checkField(rawField, `${path}.fields[${i}]`, key, fieldKeys, 1);
    });
  }

  private checkField(
    raw: unknown,
    path: string,
    prefix: string,
    seen: Set<string>,
    depth: number,
  ): void {
    this.nodeCount += 1;

    if (depth > SCHEMA_LIMITS.MAX_DEPTH) {
      this.push(
        path,
        'TOO_DEEP',
        `Nesting exceeds depth ${SCHEMA_LIMITS.MAX_DEPTH}`,
      );
      return;
    }
    if (!isRecord(raw)) {
      this.push(path, 'NOT_AN_OBJECT', 'Field must be an object');
      return;
    }

    const { key, type } = raw;
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      this.push(
        `${path}.key`,
        'INVALID_KEY',
        'Field key must match [a-zA-Z_][a-zA-Z0-9_]*',
      );
      return;
    }
    if (key.length > SCHEMA_LIMITS.MAX_KEY_LENGTH) {
      this.push(`${path}.key`, 'KEY_TOO_LONG', 'Field key is too long');
    }
    if (seen.has(key)) {
      this.push(`${path}.key`, 'DUPLICATE_KEY', `Duplicate field key "${key}"`);
    }
    seen.add(key);

    if (typeof type !== 'string' || !FIELD_TYPES.includes(type as never)) {
      this.push(
        `${path}.type`,
        'UNKNOWN_TYPE',
        `Unknown field type "${String(type)}"`,
      );
      return;
    }
    if (typeof raw.required !== 'boolean') {
      this.push(
        `${path}.required`,
        'MISSING_REQUIRED_FLAG',
        '`required` must be a boolean',
      );
    }

    // Published immediately, so an earlier sibling or an earlier step is
    // referenceable by a condition but a later field is not.
    this.declared.add(`${prefix}.${key}`);

    if (raw.condition !== undefined) {
      this.checkCondition(raw.condition, `${path}.condition`);
    }

    this.checkConstraints(
      raw as Field & Record<string, unknown>,
      path,
      prefix,
      key,
      depth,
    );
  }

  private checkConstraints(
    f: Field & Record<string, unknown>,
    path: string,
    prefix: string,
    key: string,
    depth: number,
  ): void {
    switch (f.type) {
      case 'string': {
        if (typeof f.pattern === 'string') {
          if (f.pattern.length > SCHEMA_LIMITS.MAX_PATTERN_LENGTH) {
            this.push(
              `${path}.pattern`,
              'PATTERN_TOO_LONG',
              `Pattern exceeds ${SCHEMA_LIMITS.MAX_PATTERN_LENGTH} characters`,
            );
          } else {
            try {
              new RegExp(f.pattern);
            } catch {
              this.push(
                `${path}.pattern`,
                'INVALID_PATTERN',
                'Pattern does not compile',
              );
            }
          }
        }
        this.checkRange(
          f.minLength,
          f.maxLength,
          `${path}`,
          'minLength',
          'maxLength',
        );
        break;
      }
      case 'number':
        this.checkRange(f.min, f.max, path, 'min', 'max');
        break;
      case 'enum':
      case 'multi_enum': {
        if (!Array.isArray(f.options) || f.options.length === 0) {
          this.push(
            `${path}.options`,
            'NO_OPTIONS',
            'At least one option is required',
          );
          break;
        }
        const values = new Set<string>();
        f.options.forEach((o, i) => {
          if (!isRecord(o) || typeof o.value !== 'string') {
            this.push(
              `${path}.options[${i}]`,
              'INVALID_OPTION',
              'Option needs a string `value`',
            );
            return;
          }
          if (values.has(o.value)) {
            this.push(
              `${path}.options[${i}]`,
              'DUPLICATE_OPTION',
              `Duplicate option "${o.value}"`,
            );
          }
          values.add(o.value);
        });
        break;
      }
      case 'object': {
        if (!Array.isArray(f.fields) || f.fields.length === 0) {
          this.push(
            `${path}.fields`,
            'NO_FIELDS',
            'Object must declare at least one field',
          );
          break;
        }
        const nested = new Set<string>();
        (f.fields as unknown[]).forEach((child, i) => {
          this.checkField(
            child,
            `${path}.fields[${i}]`,
            `${prefix}.${key}`,
            nested,
            depth + 1,
          );
        });
        break;
      }
      case 'array': {
        if (typeof f.maxItems !== 'number' || f.maxItems <= 0) {
          this.push(
            `${path}.maxItems`,
            'MISSING_MAX_ITEMS',
            '`maxItems` is required and must be a positive number',
          );
        }
        this.checkRange(f.minItems, f.maxItems, path, 'minItems', 'maxItems');
        if (f.item === undefined) {
          this.push(
            `${path}.item`,
            'MISSING_ITEM',
            'Array must declare an `item` field',
          );
          break;
        }
        this.checkField(
          f.item,
          `${path}.item`,
          `${prefix}.${key}`,
          new Set(),
          depth + 1,
        );
        break;
      }
      case 'file':
      case 'files': {
        if (!Array.isArray(f.accept) || f.accept.length === 0) {
          this.push(
            `${path}.accept`,
            'NO_ACCEPT',
            'At least one accepted MIME type is required',
          );
        }
        if (typeof f.maxSizeBytes !== 'number' || f.maxSizeBytes <= 0) {
          this.push(
            `${path}.maxSizeBytes`,
            'MISSING_MAX_SIZE',
            '`maxSizeBytes` is required and must be positive',
          );
        }
        if (f.type === 'files') {
          if (typeof f.maxCount !== 'number' || f.maxCount <= 0) {
            this.push(
              `${path}.maxCount`,
              'MISSING_MAX_COUNT',
              '`maxCount` is required and must be positive',
            );
          }
          this.checkRange(f.minCount, f.maxCount, path, 'minCount', 'maxCount');
        }
        break;
      }
      case 'json': {
        if (typeof f.maxBytes !== 'number' || f.maxBytes <= 0) {
          this.push(
            `${path}.maxBytes`,
            'MISSING_MAX_BYTES',
            '`maxBytes` is required and must be positive',
          );
        }
        break;
      }
      default:
        break;
    }
  }

  private checkRange(
    lo: unknown,
    hi: unknown,
    path: string,
    loName: string,
    hiName: string,
  ): void {
    if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) {
      this.push(path, 'INVALID_RANGE', `${loName} must not exceed ${hiName}`);
    }
  }

  private checkCondition(raw: unknown, path: string, depth = 0): void {
    if (depth > SCHEMA_LIMITS.MAX_DEPTH) {
      this.push(path, 'CONDITION_TOO_DEEP', 'Condition nesting is too deep');
      return;
    }
    if (!isRecord(raw)) {
      this.push(path, 'INVALID_CONDITION', 'Condition must be an object');
      return;
    }
    const op = raw.op;
    if (op === 'and' || op === 'or') {
      if (!Array.isArray(raw.of) || raw.of.length === 0) {
        this.push(
          `${path}.of`,
          'INVALID_CONDITION',
          `"${op}" requires a non-empty \`of\` array`,
        );
        return;
      }
      (raw.of as unknown[]).forEach((c, i) =>
        this.checkCondition(c, `${path}.of[${i}]`, depth + 1),
      );
      return;
    }
    if (op === 'not') {
      if (raw.of === undefined) {
        this.push(`${path}.of`, 'INVALID_CONDITION', '"not" requires `of`');
        return;
      }
      this.checkCondition(raw.of, `${path}.of`, depth + 1);
      return;
    }
    if (typeof op !== 'string' || !CONDITION_OPS.has(op)) {
      this.push(
        `${path}.op`,
        'UNKNOWN_OPERATOR',
        `Unknown condition operator "${String(op)}"`,
      );
      return;
    }
    if (typeof raw.field !== 'string' || raw.field.length === 0) {
      this.push(
        `${path}.field`,
        'INVALID_CONDITION',
        'Condition requires a `field` path',
      );
      return;
    }
    // A condition may only reference fields already declared — i.e. in an
    // earlier step, or earlier in this same step's enclosing scope. A forward
    // reference could never be satisfied at the moment the step is validated.
    if (!this.declared.has(raw.field)) {
      this.push(
        `${path}.field`,
        'FORWARD_REFERENCE',
        `Condition references "${raw.field}", which is not declared in an earlier step`,
      );
    }
    if (op !== 'exists' && raw.value === undefined) {
      this.push(
        `${path}.value`,
        'MISSING_VALUE',
        `Operator "${op}" requires a \`value\``,
      );
    }
    if (op === 'in' && !Array.isArray(raw.value)) {
      this.push(
        `${path}.value`,
        'INVALID_VALUE',
        '"in" requires an array `value`',
      );
    }
  }

  private push(path: string, code: string, message: string): void {
    this.errors.push({ path, code, message });
  }

  private fail(
    path: string,
    code: string,
    message: string,
  ): SchemaValidationResult {
    this.push(path, code, message);
    return { ok: false, errors: this.errors };
  }
}

export function validateSchema(schema: unknown): SchemaValidationResult {
  return new SchemaChecker(schema).run();
}

/** Narrowing helper for callers that have already validated. */
export function assertFormSchema(
  schema: unknown,
): asserts schema is FormSchema {
  const result = validateSchema(schema);
  if (!result.ok) {
    throw new Error(
      `Invalid FormSchema: ${result.errors.map((e) => `${e.path} ${e.code}`).join(', ')}`,
    );
  }
}

export type { FormSchema, FormStep, Field, Condition };
