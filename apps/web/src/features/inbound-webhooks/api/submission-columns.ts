export interface SubmissionColumn {
  /** `step.field` for a stepped schema, the field's own path for a flat one. */
  path: string;
}

const DEFAULT_COLUMN_COUNT = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The parts of a stored schema node this file reads; the schema is checked by the API, not here. */
interface SchemaNode {
  key?: unknown;
  type?: unknown;
  fields?: unknown;
  steps?: unknown;
}

const asNode = (value: unknown): SchemaNode | null => (isRecord(value) ? value : null);

function leafPaths(fields: unknown, prefix: string): string[] {
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((raw: unknown) => {
    const field = asNode(raw);
    if (!field || typeof field.key !== 'string') return [];
    const path = prefix ? `${prefix}.${field.key}` : field.key;
    // A list, a file and a json value stay one column; only a group of fields is opened up.
    return field.type === 'object' ? leafPaths(field.fields, path) : [path];
  });
}

/** Every answer a submission can hold, in schema order. */
export function schemaColumns(schema: Record<string, unknown>): SubmissionColumn[] {
  const root: SchemaNode = schema;
  const paths = Array.isArray(root.steps)
    ? root.steps.flatMap((raw: unknown) => {
        const step = asNode(raw);
        return step && typeof step.key === 'string' ? leafPaths(step.fields, step.key) : [];
      })
    : leafPaths(root.fields, '');
  return paths.map((path) => ({ path }));
}

export function defaultColumnPaths(schema: Record<string, unknown>): string[] {
  return schemaColumns(schema)
    .slice(0, DEFAULT_COLUMN_COUNT)
    .map((column) => column.path);
}

export function valueAtPath(payload: unknown, path: string): unknown {
  let current: unknown = payload;
  for (const key of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** What a table cell shows: scalars as written, lists and objects as JSON, long values cut short. */
export function cellText(value: unknown, max = 80): string {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
