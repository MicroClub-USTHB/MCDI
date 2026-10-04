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

// These values must match the strings used by FormSchema JSON.
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

const FIELD_TYPES = new Set<string>(Object.values(FIELD_TYPE));

const LIMIT = {
  MAX_ITEMS: 'maxItems',
  MAX_COUNT: 'maxCount',
  MAX_BYTES: 'maxBytes',
  MAX_SIZE_BYTES: 'maxSizeBytes',
} as const;

const ERROR_CODE = {
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  INVALID_VERSION: 'INVALID_VERSION',
  INVALID_STEPS: 'INVALID_STEPS',
  NODE_LIMIT_EXCEEDED: 'NODE_LIMIT_EXCEEDED',
  MAX_DEPTH_EXCEEDED: 'MAX_DEPTH_EXCEEDED',
  INVALID_STEP: 'INVALID_STEP',
  INVALID_FIELDS: 'INVALID_FIELDS',
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_KEY: 'INVALID_KEY',
  DUPLICATE_KEY: 'DUPLICATE_KEY',
  UNKNOWN_FIELD_TYPE: 'UNKNOWN_FIELD_TYPE',
  MISSING_MAX_ITEMS: 'MISSING_MAX_ITEMS',
  MISSING_MAX_COUNT: 'MISSING_MAX_COUNT',
  MISSING_MAX_BYTES: 'MISSING_MAX_BYTES',
  MISSING_MAX_SIZE_BYTES: 'MISSING_MAX_SIZE_BYTES',
  INVALID_PATTERN: 'INVALID_PATTERN',
  UNCOMPILABLE_REGEX: 'UNCOMPILABLE_REGEX',
  UNKNOWN_CONDITION_FIELD: 'UNKNOWN_CONDITION_FIELD',
  LATER_STEP_CONDITION_FIELD: 'LATER_STEP_CONDITION_FIELD',
} as const;

/** Local Layer 1 pre-check. MCDI remains authoritative; keep these rules isolated
 * so they can be reconciled with the backend validator without changing callers.
 */
export function validateSchema(value: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const add = (path: string, code: string, message: string): void => {
    errors.push({ path, code, message, source: 'local' });
  };

  if (!isRecord(value)) {
    // UNVERIFIED: MCDI's exact root-path convention is unavailable in this checkout.
    add('$', ERROR_CODE.INVALID_SCHEMA, 'Schema must be a JSON object');
    return { valid: false, errors };
  }
  if (value.version !== 1) add('version', ERROR_CODE.INVALID_VERSION, 'Schema version must be 1');
  // UNVERIFIED: whether MCDI accepts an empty steps array requires §6.4 confirmation.
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    add('steps', ERROR_CODE.INVALID_STEPS, 'Schema must contain a non-empty steps array');
    return { valid: false, errors };
  }

  // UNVERIFIED: MCDI's precise node-count definition and boundary require §6.4.
  let nodeCount = 1;
  let nodeLimitReported = false;
  const knownFields = new Map<string, number>();
  const conditionChecks: Array<{ condition: unknown; path: string; stepIndex: number }> = [];

  const visitField = (field: unknown, path: string, depth: number, stepIndex: number,
    siblingKeys: Set<string>): void => {
    nodeCount += 1;
    if (nodeCount > 200) {
      if (!nodeLimitReported) {
        add(path, ERROR_CODE.NODE_LIMIT_EXCEEDED, 'Schema contains more than 200 nodes');
        nodeLimitReported = true;
      }
      return;
    }
    if (depth > 5) {
      add(path, ERROR_CODE.MAX_DEPTH_EXCEEDED, 'Schema nesting depth exceeds 5');
      return;
    }
    if (!isRecord(field)) {
      add(path, ERROR_CODE.INVALID_FIELD, 'Field must be an object');
      return;
    }

    if (typeof field.key !== 'string' || field.key.length === 0) {
      add(`${path}.key`, ERROR_CODE.INVALID_KEY, 'Field key must be a non-empty string');
    } else {
      if (siblingKeys.has(field.key)) add(`${path}.key`, ERROR_CODE.DUPLICATE_KEY, `Duplicate key "${field.key}"`);
      siblingKeys.add(field.key);
      knownFields.set(field.key, Math.min(knownFields.get(field.key) ?? stepIndex, stepIndex));
    }

    if (typeof field.type !== 'string' || !FIELD_TYPES.has(field.type)) {
      add(`${path}.type`, ERROR_CODE.UNKNOWN_FIELD_TYPE, `Unknown field type ${JSON.stringify(field.type)}`);
    }
    if ('condition' in field) conditionChecks.push({ condition: field.condition, path: `${path}.condition`, stepIndex });

    if (field.type === FIELD_TYPE.ARRAY && !hasLimit(field, [LIMIT.MAX_ITEMS])) {
      add(path, ERROR_CODE.MISSING_MAX_ITEMS, `Array fields require ${LIMIT.MAX_ITEMS}`);
    }
    // UNVERIFIED: names/requiredness follow the m-forge PRD and need backend confirmation.
    if (field.type === FIELD_TYPE.FILES && !hasLimit(field, [LIMIT.MAX_COUNT])) {
      add(path, ERROR_CODE.MISSING_MAX_COUNT, `Files fields require ${LIMIT.MAX_COUNT}`);
    }
    if (field.type === FIELD_TYPE.JSON && !hasLimit(field, [LIMIT.MAX_BYTES, LIMIT.MAX_SIZE_BYTES])) {
      add(path, ERROR_CODE.MISSING_MAX_BYTES, `JSON fields require ${LIMIT.MAX_BYTES} or ${LIMIT.MAX_SIZE_BYTES}`);
    }
    if ((field.type === FIELD_TYPE.FILE || field.type === FIELD_TYPE.FILES) && !hasLimit(field, [LIMIT.MAX_SIZE_BYTES])) {
      add(path, ERROR_CODE.MISSING_MAX_SIZE_BYTES, `${field.type} fields require ${LIMIT.MAX_SIZE_BYTES}`);
    }

    if (field.pattern !== undefined) {
      if (typeof field.pattern !== 'string') {
        add(`${path}.pattern`, ERROR_CODE.INVALID_PATTERN, 'Pattern must be a string');
      } else if (field.pattern.length > 200) {
        add(`${path}.pattern`, ERROR_CODE.UNCOMPILABLE_REGEX, 'Pattern exceeds 200 characters');
      } else {
        try { new RegExp(field.pattern); }
        catch { add(`${path}.pattern`, ERROR_CODE.UNCOMPILABLE_REGEX, 'Pattern is not a valid regular expression'); }
      }
    }

    // UNVERIFIED: nested property names and limits must be confirmed against §6.4.
    // Object children share a key scope; array items get their own key scope.
    if (field.type === FIELD_TYPE.OBJECT && Array.isArray(field.fields)) {
      const childKeys = new Set<string>();
      field.fields.forEach((child, index) => visitField(child, `${path}.fields[${index}]`, depth + 1, stepIndex, childKeys));
    }
    // UNVERIFIED: PRD §10 names this property `item` (singular).
    if (field.type === FIELD_TYPE.ARRAY && isRecord(field.item)) {
      visitField(field.item, `${path}.item`, depth + 1, stepIndex, new Set());
    }
  };

  value.steps.forEach((step, stepIndex) => {
    const path = `steps[${stepIndex}]`;
    nodeCount += 1;
    if (!isRecord(step)) {
      add(path, ERROR_CODE.INVALID_STEP, 'Step must be an object');
      return;
    }
    if ('condition' in step) conditionChecks.push({ condition: step.condition, path: `${path}.condition`, stepIndex });
    if (!Array.isArray(step.fields)) {
      add(`${path}.fields`, ERROR_CODE.INVALID_FIELDS, 'Step fields must be an array');
      return;
    }
    const keys = new Set<string>();
    step.fields.forEach((field, fieldIndex) => visitField(field, `${path}.fields[${fieldIndex}]`, 1, stepIndex, keys));
  });
  if (nodeCount > 200 && !nodeLimitReported) {
    add('steps', ERROR_CODE.NODE_LIMIT_EXCEEDED, 'Schema contains more than 200 nodes');
  }

  for (const { condition, stepIndex } of conditionChecks) {
    // UNVERIFIED: supported condition AST reference properties are not documented locally.
    for (const ref of collectFieldReferences(condition)) {
      const definedAt = knownFields.get(ref.key);
      if (definedAt === undefined) {
        add(ref.path, ERROR_CODE.UNKNOWN_CONDITION_FIELD, `Condition references unknown field "${ref.key}"`);
      } else if (definedAt > stepIndex) {
        add(ref.path, ERROR_CODE.LATER_STEP_CONDITION_FIELD, `Condition references field "${ref.key}" from a later step`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function collectFieldReferences(value: unknown, path = ''): Array<{ key: string; path: string }> {
  if (Array.isArray(value)) return value.flatMap((item, index) => collectFieldReferences(item, `${path}[${index}]`));
  if (!isRecord(value)) return [];
  const refs: Array<{ key: string; path: string }> = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if ((key === 'field' || key === 'fieldKey') && typeof child === 'string') refs.push({ key: child, path: childPath });
    else refs.push(...collectFieldReferences(child, childPath));
  }
  return refs;
}

function hasLimit(value: Record<string, unknown>, names: string[]): boolean {
  return names.some((name) => typeof value[name] === 'number' && Number.isFinite(value[name]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
