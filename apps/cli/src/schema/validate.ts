import { isISO8601, isRFC3339 } from 'class-validator';

export interface ValidationError {
  path: string;
  code: string;
  message: string;
  source: 'local';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const FIELD_TYPE = {
  STRING: 'string',
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  EMAIL: 'email',
  URL: 'url',
  PHONE: 'phone',
  DATE: 'date',
  DATETIME: 'datetime',
  ENUM: 'enum',
  MULTI_ENUM: 'multi_enum',
  OBJECT: 'object',
  ARRAY: 'array',
  FILE: 'file',
  FILES: 'files',
  JSON: 'json',
} as const;

type FieldType = (typeof FIELD_TYPE)[keyof typeof FIELD_TYPE];

const FIELD_TYPES = new Set<string>(Object.values(FIELD_TYPE));
/** The 16 FormSchema field types, for callers like the custom rule engine. */
export const FIELD_TYPE_NAMES: readonly string[] = Object.values(FIELD_TYPE);
const FIELD_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_DEPTH = 5;
const MAX_NODES = 200;
const MAX_STEPS = 20;
const MAX_PATTERN_LENGTH = 200;
const MAX_KEY_LENGTH = 64;

const ERROR_CODE = {
  NOT_AN_OBJECT: 'NOT_AN_OBJECT',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  NO_STEPS: 'NO_STEPS',
  TOO_MANY_STEPS: 'TOO_MANY_STEPS',
  INVALID_KEY: 'INVALID_KEY',
  DUPLICATE_KEY: 'DUPLICATE_KEY',
  KEY_TOO_LONG: 'KEY_TOO_LONG',
  UNKNOWN_TYPE: 'UNKNOWN_TYPE',
  MISSING_REQUIRED_FLAG: 'MISSING_REQUIRED_FLAG',
  TOO_DEEP: 'TOO_DEEP',
  TOO_MANY_NODES: 'TOO_MANY_NODES',
  UNKNOWN_PROPERTY: 'UNKNOWN_PROPERTY',
  INVALID_CONSTRAINT: 'INVALID_CONSTRAINT',
  PATTERN_TOO_LONG: 'PATTERN_TOO_LONG',
  INVALID_PATTERN: 'INVALID_PATTERN',
  INVALID_RANGE: 'INVALID_RANGE',
  NO_OPTIONS: 'NO_OPTIONS',
  INVALID_OPTION: 'INVALID_OPTION',
  DUPLICATE_OPTION: 'DUPLICATE_OPTION',
  NO_FIELDS: 'NO_FIELDS',
  MISSING_MAX_ITEMS: 'MISSING_MAX_ITEMS',
  MISSING_ITEM: 'MISSING_ITEM',
  NO_ACCEPT: 'NO_ACCEPT',
  MISSING_MAX_SIZE: 'MISSING_MAX_SIZE',
  MISSING_MAX_COUNT: 'MISSING_MAX_COUNT',
  MISSING_MAX_BYTES: 'MISSING_MAX_BYTES',
  CONDITION_TOO_DEEP: 'CONDITION_TOO_DEEP',
  INVALID_CONDITION: 'INVALID_CONDITION',
  UNKNOWN_OPERATOR: 'UNKNOWN_OPERATOR',
  UNRESOLVABLE_REFERENCE: 'UNRESOLVABLE_REFERENCE',
  FORWARD_REFERENCE: 'FORWARD_REFERENCE',
  RELATIVE_REFERENCE_OUTSIDE_ITEM: 'RELATIVE_REFERENCE_OUTSIDE_ITEM',
  MISSING_VALUE: 'MISSING_VALUE',
  INVALID_VALUE: 'INVALID_VALUE',
} as const;

const CONDITION_OPERATORS = new Set([
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

/** `./field` inside an array item means "this entry's own field", resolved against `ItemScope`. */
const ITEM_REF_PREFIX = './';

interface ItemScope {
  /** The item root's absolute field path, e.g. "identity.members.member". */
  root: string;
  /** Paths relative to `root` declared so far, in document order. */
  declared: Set<string>;
  /** True only while validating the item's own root field, which is the `./` root, not a field of it. */
  awaitingRoot: boolean;
}

const BASE_PROPERTIES = new Set([
  'key',
  'type',
  'label',
  'description',
  'required',
  'condition',
  'default',
]);

type Constraint = { accepts(value: unknown): boolean; expected: string };
const booleanConstraint: Constraint = {
  accepts: (value) => typeof value === 'boolean',
  expected: 'a boolean',
};
const stringConstraint: Constraint = {
  accepts: (value) => typeof value === 'string',
  expected: 'a string',
};
const numberConstraint: Constraint = {
  accepts: (value) => typeof value === 'number' && Number.isFinite(value),
  expected: 'a number',
};
const countConstraint: Constraint = {
  accepts: (value) => Number.isInteger(value) && (value as number) >= 0,
  expected: 'a non-negative integer',
};
const stringsConstraint: Constraint = {
  accepts: (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.length > 0),
  expected: 'a non-empty array of strings',
};
const schemesConstraint: Constraint = {
  accepts: (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item === 'http' || item === 'https'),
  expected: 'a non-empty array of "http" and/or "https"',
};
const dateConstraint: Constraint = {
  accepts: isCalendarDate,
  expected: 'a real date as YYYY-MM-DD',
};
const dateTimeConstraint: Constraint = {
  accepts: isDateTime,
  expected: 'an ISO 8601 date-time with a timezone',
};
// The constraint's dedicated check runs in validateTypeConstraints.
const validatedSeparately: Constraint = { accepts: () => true, expected: '' };

const TYPE_PROPERTIES: Record<FieldType, Record<string, Constraint>> = {
  string: {
    minLength: countConstraint,
    maxLength: countConstraint,
    pattern: stringConstraint,
    trim: booleanConstraint,
  },
  text: { maxLength: countConstraint },
  number: { min: numberConstraint, max: numberConstraint, integer: booleanConstraint },
  boolean: {},
  email: { allowedDomains: stringsConstraint },
  url: { allowedSchemes: schemesConstraint },
  phone: { region: stringConstraint },
  date: { min: dateConstraint, max: dateConstraint },
  datetime: { min: dateTimeConstraint, max: dateTimeConstraint },
  enum: { options: validatedSeparately },
  multi_enum: {
    options: validatedSeparately,
    minSelected: countConstraint,
    maxSelected: countConstraint,
  },
  object: { fields: validatedSeparately },
  array: { item: validatedSeparately, minItems: countConstraint, maxItems: validatedSeparately },
  file: { accept: validatedSeparately, maxSizeBytes: validatedSeparately },
  files: {
    accept: validatedSeparately,
    maxSizeBytes: validatedSeparately,
    minCount: countConstraint,
    maxCount: validatedSeparately,
  },
  json: { maxBytes: validatedSeparately },
};

class SchemaChecker {
  private readonly errors: ValidationError[] = [];
  private fieldNodeCount = 0;
  /** Dotted field paths declared before the current condition is checked. */
  private readonly declaredFields = new Set<string>();
  /** Fields within array items cannot be addressed by a dotted condition path. */
  private readonly arrayItemFields = new Set<string>();
  /** The innermost array item we're currently validating fields of, if any. */
  private readonly itemScopeStack: ItemScope[] = [];

  constructor(private readonly schema: unknown) {}

  run(): ValidationResult {
    if (!isRecord(this.schema)) {
      return this.fail('', ERROR_CODE.NOT_AN_OBJECT, 'Schema must be an object');
    }

    if (this.schema.version !== 1) {
      this.add('version', ERROR_CODE.UNSUPPORTED_VERSION, 'Only version 1 is supported');
    }

    if (!Array.isArray(this.schema.steps) || this.schema.steps.length === 0) {
      return this.fail('steps', ERROR_CODE.NO_STEPS, 'Schema must declare at least one step');
    }
    if (this.schema.steps.length > MAX_STEPS) {
      this.add('steps', ERROR_CODE.TOO_MANY_STEPS, `At most ${MAX_STEPS} steps are allowed`);
    }

    const seenStepKeys = new Set<string>();
    this.schema.steps.forEach((step, index) =>
      this.validateStep(step, `steps[${index}]`, seenStepKeys),
    );

    if (this.fieldNodeCount > MAX_NODES) {
      this.add(
        '',
        ERROR_CODE.TOO_MANY_NODES,
        `Schema declares ${this.fieldNodeCount} fields; the limit is ${MAX_NODES}`,
      );
    }
    return { valid: this.errors.length === 0, errors: this.errors };
  }

  private validateStep(value: unknown, path: string, seenStepKeys: Set<string>): void {
    if (!isRecord(value)) {
      this.add(path, ERROR_CODE.NOT_AN_OBJECT, 'Step must be an object');
      return;
    }

    const key = value.key;
    if (typeof key !== 'string' || !FIELD_KEY_PATTERN.test(key)) {
      this.add(`${path}.key`, ERROR_CODE.INVALID_KEY, 'Step key must match [a-zA-Z_][a-zA-Z0-9_]*');
      return;
    }
    if (seenStepKeys.has(key))
      this.add(`${path}.key`, ERROR_CODE.DUPLICATE_KEY, `Duplicate step key "${key}"`);
    seenStepKeys.add(key);

    // Check step conditions before declaring this step's fields.
    if (value.condition !== undefined) this.validateCondition(value.condition, `${path}.condition`);

    if (!Array.isArray(value.fields) || value.fields.length === 0) {
      this.add(`${path}.fields`, ERROR_CODE.NO_FIELDS, 'Step must declare at least one field');
      return;
    }
    const seenFieldKeys = new Set<string>();
    value.fields.forEach((field, index) =>
      this.validateField(field, `${path}.fields[${index}]`, key, seenFieldKeys, 1),
    );
  }

  private validateField(
    value: unknown,
    path: string,
    parentPath: string,
    seenKeys: Set<string>,
    depth: number,
    insideArray = false,
  ): void {
    this.fieldNodeCount += 1;
    if (depth > MAX_DEPTH) {
      this.add(path, ERROR_CODE.TOO_DEEP, `Nesting exceeds depth ${MAX_DEPTH}`);
      return;
    }
    if (!isRecord(value)) {
      this.add(path, ERROR_CODE.NOT_AN_OBJECT, 'Field must be an object');
      return;
    }

    const { key, type } = value;
    if (typeof key !== 'string' || !FIELD_KEY_PATTERN.test(key)) {
      this.add(
        `${path}.key`,
        ERROR_CODE.INVALID_KEY,
        'Field key must match [a-zA-Z_][a-zA-Z0-9_]*',
      );
      return;
    }
    if (key.length > MAX_KEY_LENGTH)
      this.add(`${path}.key`, ERROR_CODE.KEY_TOO_LONG, 'Field key is too long');
    if (seenKeys.has(key))
      this.add(`${path}.key`, ERROR_CODE.DUPLICATE_KEY, `Duplicate field key "${key}"`);
    seenKeys.add(key);

    if (typeof type !== 'string' || !FIELD_TYPES.has(type)) {
      this.add(`${path}.type`, ERROR_CODE.UNKNOWN_TYPE, `Unknown field type "${String(type)}"`);
      return;
    }
    if (typeof value.required !== 'boolean') {
      this.add(
        `${path}.required`,
        ERROR_CODE.MISSING_REQUIRED_FLAG,
        '`required` must be a boolean',
      );
    }

    const itemScope = this.itemScopeStack[this.itemScopeStack.length - 1];
    const isItemRoot = itemScope?.awaitingRoot === true;

    if (value.condition !== undefined) this.validateCondition(value.condition, `${path}.condition`);
    if (itemScope) itemScope.awaitingRoot = false;

    const fieldPath = `${parentPath}.${key}`;
    (insideArray ? this.arrayItemFields : this.declaredFields).add(fieldPath);
    // The item itself is the `./` root, not a field of it.
    if (itemScope && !isItemRoot)
      itemScope.declared.add(fieldPath.slice(itemScope.root.length + 1));

    this.validateProperties(value, type as FieldType, path);
    this.validateTypeConstraints(value, type as FieldType, path, fieldPath, depth, insideArray);
  }

  private validateProperties(value: Record<string, unknown>, type: FieldType, path: string): void {
    for (const [name, constraintValue] of Object.entries(value)) {
      if (BASE_PROPERTIES.has(name) || constraintValue === undefined) continue;
      const constraint = TYPE_PROPERTIES[type][name];
      if (!constraint) {
        this.add(
          `${path}.${name}`,
          ERROR_CODE.UNKNOWN_PROPERTY,
          `"${name}" is not a property of a ${type} field`,
        );
      } else if (!constraint.accepts(constraintValue)) {
        this.add(
          `${path}.${name}`,
          ERROR_CODE.INVALID_CONSTRAINT,
          `\`${name}\` must be ${constraint.expected}`,
        );
      }
    }
  }

  private validateTypeConstraints(
    field: Record<string, unknown>,
    type: FieldType,
    path: string,
    fieldPath: string,
    depth: number,
    insideArray: boolean,
  ): void {
    switch (type) {
      case FIELD_TYPE.STRING:
        this.validatePattern(field, path);
        this.validateRange(field.minLength, field.maxLength, path, 'minLength', 'maxLength');
        break;
      case FIELD_TYPE.NUMBER:
        this.validateRange(field.min, field.max, path, 'min', 'max');
        break;
      case FIELD_TYPE.DATE:
      case FIELD_TYPE.DATETIME:
        if (Date.parse(String(field.min ?? '')) > Date.parse(String(field.max ?? ''))) {
          this.add(path, ERROR_CODE.INVALID_RANGE, 'min must not exceed max');
        }
        break;
      case FIELD_TYPE.ENUM:
      case FIELD_TYPE.MULTI_ENUM:
        this.validateOptions(field.options, `${path}.options`);
        break;
      case FIELD_TYPE.OBJECT:
        this.validateObjectFields(field.fields, path, fieldPath, depth, insideArray);
        break;
      case FIELD_TYPE.ARRAY:
        this.validateArray(field, path, fieldPath, depth);
        break;
      case FIELD_TYPE.FILE:
      case FIELD_TYPE.FILES:
        this.validateFile(field, type, path);
        break;
      case FIELD_TYPE.JSON:
        if (typeof field.maxBytes !== 'number' || field.maxBytes <= 0) {
          this.add(
            `${path}.maxBytes`,
            ERROR_CODE.MISSING_MAX_BYTES,
            '`maxBytes` is required and must be positive',
          );
        }
        break;
      default:
        break;
    }
  }

  private validatePattern(field: Record<string, unknown>, path: string): void {
    if (typeof field.pattern !== 'string') return;
    if (field.pattern.length > MAX_PATTERN_LENGTH) {
      this.add(
        `${path}.pattern`,
        ERROR_CODE.PATTERN_TOO_LONG,
        `Pattern exceeds ${MAX_PATTERN_LENGTH} characters`,
      );
      return;
    }
    try {
      new RegExp(field.pattern);
    } catch {
      this.add(`${path}.pattern`, ERROR_CODE.INVALID_PATTERN, 'Pattern does not compile');
    }
  }

  private validateOptions(value: unknown, path: string): void {
    if (!Array.isArray(value) || value.length === 0) {
      this.add(path, ERROR_CODE.NO_OPTIONS, 'At least one option is required');
      return;
    }
    const seenValues = new Set<string>();
    value.forEach((option, index) => {
      if (!isRecord(option) || typeof option.value !== 'string') {
        this.add(`${path}[${index}]`, ERROR_CODE.INVALID_OPTION, 'Option needs a string `value`');
        return;
      }
      if (seenValues.has(option.value))
        this.add(
          `${path}[${index}]`,
          ERROR_CODE.DUPLICATE_OPTION,
          `Duplicate option "${option.value}"`,
        );
      seenValues.add(option.value);
    });
  }

  private validateObjectFields(
    value: unknown,
    path: string,
    fieldPath: string,
    depth: number,
    insideArray: boolean,
  ): void {
    if (!Array.isArray(value) || value.length === 0) {
      this.add(`${path}.fields`, ERROR_CODE.NO_FIELDS, 'Object must declare at least one field');
      return;
    }
    const seenKeys = new Set<string>();
    value.forEach((child, index) =>
      this.validateField(
        child,
        `${path}.fields[${index}]`,
        fieldPath,
        seenKeys,
        depth + 1,
        insideArray,
      ),
    );
  }

  private validateArray(
    field: Record<string, unknown>,
    path: string,
    fieldPath: string,
    depth: number,
  ): void {
    if (typeof field.maxItems !== 'number' || field.maxItems <= 0) {
      this.add(
        `${path}.maxItems`,
        ERROR_CODE.MISSING_MAX_ITEMS,
        '`maxItems` is required and must be a positive number',
      );
    }
    this.validateRange(field.minItems, field.maxItems, path, 'minItems', 'maxItems');
    if (field.item === undefined) {
      this.add(`${path}.item`, ERROR_CODE.MISSING_ITEM, 'Array must declare an `item` field');
      return;
    }
    const itemKey =
      isRecord(field.item) && typeof field.item.key === 'string' ? field.item.key : '<item>';
    this.itemScopeStack.push({
      root: `${fieldPath}.${itemKey}`,
      declared: new Set(),
      awaitingRoot: true,
    });
    this.validateField(field.item, `${path}.item`, fieldPath, new Set(), depth + 1, true);
    this.itemScopeStack.pop();
  }

  private validateFile(field: Record<string, unknown>, type: FieldType, path: string): void {
    if (!Array.isArray(field.accept) || field.accept.length === 0) {
      this.add(
        `${path}.accept`,
        ERROR_CODE.NO_ACCEPT,
        'At least one accepted MIME type is required',
      );
    }
    if (typeof field.maxSizeBytes !== 'number' || field.maxSizeBytes <= 0) {
      this.add(
        `${path}.maxSizeBytes`,
        ERROR_CODE.MISSING_MAX_SIZE,
        '`maxSizeBytes` is required and must be positive',
      );
    }
    if (type === FIELD_TYPE.FILES) {
      if (typeof field.maxCount !== 'number' || field.maxCount <= 0) {
        this.add(
          `${path}.maxCount`,
          ERROR_CODE.MISSING_MAX_COUNT,
          '`maxCount` is required and must be positive',
        );
      }
      this.validateRange(field.minCount, field.maxCount, path, 'minCount', 'maxCount');
    }
  }

  private validateRange(
    low: unknown,
    high: unknown,
    path: string,
    lowName: string,
    highName: string,
  ): void {
    if (typeof low === 'number' && typeof high === 'number' && low > high) {
      this.add(path, ERROR_CODE.INVALID_RANGE, `${lowName} must not exceed ${highName}`);
    }
  }

  private validateCondition(value: unknown, path: string, depth = 0): void {
    if (depth > MAX_DEPTH) {
      this.add(path, ERROR_CODE.CONDITION_TOO_DEEP, 'Condition nesting is too deep');
      return;
    }
    if (!isRecord(value)) {
      this.add(path, ERROR_CODE.INVALID_CONDITION, 'Condition must be an object');
      return;
    }

    const operator = value.op;
    if (operator === 'and' || operator === 'or') {
      if (!Array.isArray(value.of) || value.of.length === 0) {
        this.add(
          `${path}.of`,
          ERROR_CODE.INVALID_CONDITION,
          `"${operator}" requires a non-empty \`of\` array`,
        );
        return;
      }
      value.of.forEach((condition, index) =>
        this.validateCondition(condition, `${path}.of[${index}]`, depth + 1),
      );
      return;
    }
    if (operator === 'not') {
      if (value.of === undefined) {
        this.add(`${path}.of`, ERROR_CODE.INVALID_CONDITION, '"not" requires `of`');
        return;
      }
      this.validateCondition(value.of, `${path}.of`, depth + 1);
      return;
    }
    if (typeof operator !== 'string' || !CONDITION_OPERATORS.has(operator)) {
      this.add(
        `${path}.op`,
        ERROR_CODE.UNKNOWN_OPERATOR,
        `Unknown condition operator "${String(operator)}"`,
      );
      return;
    }
    if (typeof value.field !== 'string' || value.field.length === 0) {
      this.add(`${path}.field`, ERROR_CODE.INVALID_CONDITION, 'Condition requires a `field` path');
      return;
    }
    if (value.field.startsWith(ITEM_REF_PREFIX)) {
      this.validateItemReference(value.field, `${path}.field`);
    } else if (this.arrayItemFields.has(value.field)) {
      this.add(
        `${path}.field`,
        ERROR_CODE.UNRESOLVABLE_REFERENCE,
        `Condition references "${value.field}", which is inside an array and cannot be addressed by a path. ` +
          'To use a field of the same array item, write it relative to the item, for example ./role',
      );
    } else if (!this.declaredFields.has(value.field)) {
      this.add(
        `${path}.field`,
        ERROR_CODE.FORWARD_REFERENCE,
        `Condition references "${value.field}", which is not declared in an earlier step`,
      );
    }
    if (operator !== 'exists' && value.value === undefined) {
      this.add(
        `${path}.value`,
        ERROR_CODE.MISSING_VALUE,
        `Operator "${operator}" requires a \`value\``,
      );
    }
    if (operator === 'in' && !Array.isArray(value.value)) {
      this.add(`${path}.value`, ERROR_CODE.INVALID_VALUE, '"in" requires an array `value`');
    }
  }

  /** Resolves a `./field` condition against the innermost array item, per MCDI's ITEM_REF_PREFIX rule. */
  private validateItemReference(field: string, path: string): void {
    const itemScope = this.itemScopeStack[this.itemScopeStack.length - 1];
    if (!itemScope || itemScope.awaitingRoot) {
      this.add(
        path,
        ERROR_CODE.RELATIVE_REFERENCE_OUTSIDE_ITEM,
        `"${field}" is only valid on a field inside an array of objects: elsewhere there is no entry for ./ to point at`,
      );
      return;
    }
    const relative = field.slice(ITEM_REF_PREFIX.length);
    if (relative === '') {
      this.add(
        path,
        ERROR_CODE.INVALID_CONDITION,
        'A ./ reference needs a field name after it, for example ./role',
      );
      return;
    }
    if (!itemScope.declared.has(relative)) {
      this.add(
        path,
        ERROR_CODE.FORWARD_REFERENCE,
        `Condition references "${field}", which is not declared earlier in the same array item`,
      );
    }
  }

  private add(path: string, code: string, message: string): void {
    this.errors.push({ path, code, message, source: 'local' });
  }

  private fail(path: string, code: string, message: string): ValidationResult {
    this.add(path, code, message);
    return { valid: false, errors: this.errors };
  }
}

export function validateSchema(value: unknown): ValidationResult {
  return new SchemaChecker(value).run();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isISO8601(value, { strict: true })
  );
}

function isDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    isRFC3339(value) &&
    isISO8601(value, { strict: true, strictSeparator: true })
  );
}
