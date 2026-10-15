/**
 * The schema definition language for inbound webhooks.
 *
 * A schema is a list of steps; each step is a list of fields. A single-step
 * form is the degenerate case, never a separate code path. A schema may
 * instead list fields directly, for a payload that is not a form.
 *
 * Fields are a discriminated union on `type` rather than a flat bag of
 * optional constraints, so `{ type: 'boolean', minLength: 5 }` is a compile
 * error instead of a silently ignored property.
 */

export type Option = { value: string; label?: string };

export type ConditionOp =
  'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'exists';

/**
 * A deliberately tiny AST. Never `eval`, never a JS expression string.
 * `field` is a dotted path into the accumulated submission data,
 * e.g. "identity.status".
 *
 * Inside an array of objects a path cannot say which entry it means, so a
 * `field` starting with `./` is relative to the nearest enclosing array item:
 * `./role` is the `role` of this same entry, `./address.city` a nested path
 * inside it. It may only name a field declared earlier in the same item.
 */
export type Condition =
  | { op: ConditionOp; field: string; value?: unknown }
  | { op: 'and'; of: Condition[] }
  | { op: 'or'; of: Condition[] }
  | { op: 'not'; of: Condition };

export type BaseField = {
  key: string;
  label?: string;
  description?: string;
  required: boolean;
  condition?: Condition;
  default?: unknown;
};

export type StringField = BaseField & {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  trim?: boolean;
};
export type TextField = BaseField & { type: 'text'; maxLength?: number };
export type NumberField = BaseField & {
  type: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
};
export type BooleanField = BaseField & { type: 'boolean' };
export type EmailField = BaseField & {
  type: 'email';
  allowedDomains?: string[];
};
export type UrlField = BaseField & {
  type: 'url';
  allowedSchemes?: ('http' | 'https')[];
};
export type PhoneField = BaseField & { type: 'phone'; region?: string };
export type DateField = BaseField & {
  type: 'date';
  min?: string;
  max?: string;
};
export type DateTimeField = BaseField & {
  type: 'datetime';
  min?: string;
  max?: string;
};
export type EnumField = BaseField & { type: 'enum'; options: Option[] };
export type MultiEnumField = BaseField & {
  type: 'multi_enum';
  options: Option[];
  minSelected?: number;
  maxSelected?: number;
};
export type ObjectField = BaseField & { type: 'object'; fields: Field[] };
/** `maxItems` is REQUIRED: an unbounded array is an unbounded validation loop. */
export type ArrayField = BaseField & {
  type: 'array';
  item: Field;
  minItems?: number;
  maxItems: number;
};
export type FileField = BaseField & {
  type: 'file';
  accept: string[];
  maxSizeBytes: number;
};
export type FilesField = BaseField & {
  type: 'files';
  accept: string[];
  maxSizeBytes: number;
  minCount?: number;
  maxCount: number;
};
export type JsonField = BaseField & { type: 'json'; maxBytes: number };

export type Field =
  | StringField
  | TextField
  | NumberField
  | BooleanField
  | EmailField
  | UrlField
  | PhoneField
  | DateField
  | DateTimeField
  | EnumField
  | MultiEnumField
  | ObjectField
  | ArrayField
  | FileField
  | FilesField
  | JsonField;

export type FieldType = Field['type'];

export const FIELD_TYPES: readonly FieldType[] = [
  'string',
  'text',
  'number',
  'boolean',
  'email',
  'url',
  'phone',
  'date',
  'datetime',
  'enum',
  'multi_enum',
  'object',
  'array',
  'file',
  'files',
  'json',
] as const;

export type FormStep = {
  key: string;
  title?: string;
  description?: string;
  condition?: Condition;
  fields: Field[];
};

export type SteppedFormSchema = {
  version: 1;
  steps: FormStep[];
};

/**
 * Fields at the top level, no steps: the payload is a flat object of those
 * fields. For data that is not a form, such as one kind of event.
 */
export type FlatFormSchema = {
  version: 1;
  fields: Field[];
};

export type FormSchema = SteppedFormSchema | FlatFormSchema;

/**
 * The key of the single step a flat schema is read as. A step with this key
 * has no name in the payload or in paths: its fields sit at the root.
 */
export const ROOT_STEP_KEY = '';

export function isFlatSchema(schema: FormSchema): schema is FlatFormSchema {
  return 'fields' in schema;
}

/** One shape for the code that walks steps; a flat schema becomes one root step. */
export function normalizeSchema(schema: FormSchema): SteppedFormSchema {
  return isFlatSchema(schema)
    ? { version: 1, steps: [{ key: ROOT_STEP_KEY, fields: schema.fields }] }
    : schema;
}

/** `a` + `b` is `a.b`; with nothing before it, just `b`. */
export function dotPath(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

// ─── Limits (enforced by the Layer-1 schema validator) ───────────────────

export const SCHEMA_LIMITS = {
  /** Nesting depth of object/array composition */
  MAX_DEPTH: 5,
  /** Total field nodes across every step */
  MAX_NODES: 200,
  /** A longer stored regex is a ReDoS on every future submission */
  MAX_PATTERN_LENGTH: 200,
  MAX_STEPS: 20,
  MAX_KEY_LENGTH: 64,
} as const;

/** Keys must be safe to use in a dotted path and as an object key. */
export const KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
