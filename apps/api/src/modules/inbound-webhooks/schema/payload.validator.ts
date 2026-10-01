/**
 * Layer 2 — validates a submission payload against a known-good FormSchema.
 *
 * Ordering rule: conditions resolve FIRST, producing the active field set;
 * only then is validation applied. A `required` field inside a false
 * condition must not block submission, and any value sent for it is
 * stripped. Getting this backwards makes every branching form unsubmittable.
 */
import {
  Condition,
  Field,
  FormSchema,
  FormStep,
  SCHEMA_LIMITS,
} from './form-schema.types';
import { createContext, Script } from 'vm';
import { evaluateCondition } from './condition.evaluator';

export type FieldError = { path: string; code: string; message: string };

export type PayloadValidationResult =
  | { ok: true; value: Record<string, unknown>; fileIds: string[] }
  | { ok: false; errors: FieldError[] };

/** Metadata for an already-uploaded file, supplied by the caller. */
export type FileMeta = {
  id: string;
  webhookId: string;
  mime: string;
  sizeBytes: number;
  status: 'pending' | 'committed' | 'orphaned';
  expiresAt: Date | null;
};

export type ValidateOptions = {
  rejectUnknownFields: boolean;
  /** Restrict validation to a single step, for the draft step-patch route. */
  onlyStep?: string;
  /** Known uploaded files, keyed by file id. Absent means files cannot resolve. */
  files?: Map<string, FileMeta>;
  webhookId?: string;
  now?: Date;
};

// Domain labels exclude '.', so the match is unambiguous and runs in linear
// time. Letting '.' into the label class made it quadratic on "a@.....@".
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
/** RFC 5321 caps a forward path at 254 characters. */
const EMAIL_MAX_LENGTH = 254;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;

/** Budget for one admin-authored pattern test. */
const PATTERN_TIMEOUT_MS = 50;
const patternSandbox: { re?: RegExp; s?: string } = {};
const patternContext = createContext(patternSandbox);
const patternScript = new Script('re.test(s)');

/**
 * Tests a stored pattern under a time budget. `vm` is used only for its
 * timeout: a pattern like `(a+)+$` is interrupted instead of blocking the
 * event loop for every route. Throws on timeout.
 */
function testPattern(pattern: string, value: string): boolean {
  patternSandbox.re = new RegExp(pattern);
  patternSandbox.s = value;
  return patternScript.runInContext(patternContext, {
    timeout: PATTERN_TIMEOUT_MS,
  }) as boolean;
}

/** Aborts validation: one request may spend the pattern budget only once. */
class PatternTimeoutError extends Error {
  constructor(readonly path: string) {
    super(`Pattern timed out at ${path}`);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class PayloadChecker {
  private readonly errors: FieldError[] = [];
  private readonly fileIds: string[] = [];

  constructor(
    private readonly schema: FormSchema,
    private readonly opts: ValidateOptions,
  ) {}

  run(payload: Record<string, unknown>): PayloadValidationResult {
    try {
      return this.check(payload);
    } catch (error) {
      if (!(error instanceof PatternTimeoutError)) throw error;
      this.push(
        error.path,
        'PATTERN_TIMEOUT',
        'Value could not be checked against the required format in time',
      );
      return { ok: false, errors: this.errors };
    }
  }

  private check(payload: Record<string, unknown>): PayloadValidationResult {
    const steps = this.opts.onlyStep
      ? this.schema.steps.filter((s) => s.key === this.opts.onlyStep)
      : this.schema.steps;

    if (this.opts.onlyStep && steps.length === 0) {
      return {
        ok: false,
        errors: [
          {
            path: this.opts.onlyStep,
            code: 'UNKNOWN_STEP',
            message: `No step named "${this.opts.onlyStep}"`,
          },
        ],
      };
    }

    if (this.opts.rejectUnknownFields) {
      const known = new Set(this.schema.steps.map((s) => s.key));
      for (const key of Object.keys(payload)) {
        if (!known.has(key)) {
          this.push(key, 'UNKNOWN_STEP', `Unknown step "${key}"`);
        }
      }
    }

    // `out` accumulates as we go, so a later step's condition can read an
    // earlier step's coerced values.
    const out: Record<string, unknown> = {};

    for (const step of steps) {
      // Conditions are evaluated against everything accepted so far plus the
      // raw payload, so cross-step references resolve either way.
      const scope = { ...payload, ...out };
      if (!this.isActive(step, scope)) continue;

      const raw = payload[step.key];
      if (raw !== undefined && !isRecord(raw)) {
        this.push(step.key, 'NOT_AN_OBJECT', 'Step payload must be an object');
        continue;
      }

      const stepData = isRecord(raw) ? raw : {};
      const result = this.checkFields(
        step.fields,
        stepData,
        step.key,
        scope,
        1,
      );
      out[step.key] = result;
    }

    return this.errors.length === 0
      ? { ok: true, value: out, fileIds: this.fileIds }
      : { ok: false, errors: this.errors };
  }

  private isActive(
    node: { condition?: Condition },
    scope: Record<string, unknown>,
  ): boolean {
    return evaluateCondition(node.condition, scope);
  }

  private checkFields(
    fields: Field[],
    data: Record<string, unknown>,
    path: string,
    scope: Record<string, unknown>,
    depth: number,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const active = fields.filter((f) => this.isActive(f, scope));
    const activeKeys = new Set(active.map((f) => f.key));

    if (this.opts.rejectUnknownFields) {
      for (const key of Object.keys(data)) {
        // A key belonging to a condition-inactive field is stripped silently,
        // not reported — the caller may legitimately send a full payload.
        const declared = fields.some((f) => f.key === key);
        if (!declared) {
          this.push(
            `${path}.${key}`,
            'UNKNOWN_FIELD',
            `Unknown field "${key}"`,
          );
        }
      }
    }

    for (const field of active) {
      const fieldPath = `${path}.${field.key}`;
      const raw = data[field.key];

      if (raw === undefined || raw === null || raw === '') {
        if (field.required) {
          this.push(fieldPath, 'REQUIRED', 'Field is required');
        } else if (field.default !== undefined) {
          out[field.key] = field.default;
        }
        continue;
      }

      const value = this.checkField(field, raw, fieldPath, scope, depth);
      if (value !== undefined) out[field.key] = value;
    }

    // Anything not active is absent from `out` — i.e. stripped.
    void activeKeys;
    return out;
  }

  private checkField(
    field: Field,
    raw: unknown,
    path: string,
    scope: Record<string, unknown>,
    depth: number,
  ): unknown {
    if (depth > SCHEMA_LIMITS.MAX_DEPTH) {
      this.push(path, 'TOO_DEEP', 'Payload nesting is too deep');
      return undefined;
    }

    switch (field.type) {
      case 'string':
      case 'text': {
        if (typeof raw !== 'string') {
          return this.typeError(path, 'string');
        }
        let v = raw;
        if (field.type === 'string' && field.trim) v = v.trim();
        const min = field.type === 'string' ? field.minLength : undefined;
        const max = field.maxLength;
        if (min !== undefined && v.length < min) {
          this.push(path, 'TOO_SHORT', `Must be at least ${min} characters`);
        }
        if (max !== undefined && v.length > max) {
          this.push(path, 'TOO_LONG', `Must be at most ${max} characters`);
          return v;
        }
        if (field.type === 'string' && field.pattern) {
          let matches: boolean;
          try {
            matches = testPattern(field.pattern, v);
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code ===
              'ERR_SCRIPT_EXECUTION_TIMEOUT'
            ) {
              throw new PatternTimeoutError(path);
            }
            // Layer 1 guarantees this compiles; ignore defensively.
            matches = true;
          }
          if (!matches) {
            this.push(
              path,
              'PATTERN_MISMATCH',
              'Value does not match the required format',
            );
          }
        }
        return v;
      }

      case 'number': {
        const n =
          typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
        if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n)) {
          return this.typeError(path, 'number');
        }
        if (field.integer && !Number.isInteger(n)) {
          this.push(path, 'NOT_AN_INTEGER', 'Must be a whole number');
        }
        if (field.min !== undefined && n < field.min) {
          this.push(path, 'OUT_OF_RANGE', `Must be at least ${field.min}`);
        }
        if (field.max !== undefined && n > field.max) {
          this.push(path, 'OUT_OF_RANGE', `Must be at most ${field.max}`);
        }
        return n;
      }

      case 'boolean': {
        if (typeof raw === 'boolean') return raw;
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        return this.typeError(path, 'boolean');
      }

      case 'email': {
        if (typeof raw !== 'string') return this.typeError(path, 'string');
        const v = raw.trim().toLowerCase();
        if (v.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(v)) {
          this.push(path, 'INVALID_EMAIL', 'Not a valid email address');
          return undefined;
        }
        if (field.allowedDomains?.length) {
          const domain = v.slice(v.lastIndexOf('@') + 1);
          if (
            !field.allowedDomains.map((d) => d.toLowerCase()).includes(domain)
          ) {
            this.push(
              path,
              'DOMAIN_NOT_ALLOWED',
              `Domain "${domain}" is not accepted`,
            );
          }
        }
        return v;
      }

      case 'url': {
        if (typeof raw !== 'string') return this.typeError(path, 'string');
        let parsed: URL;
        try {
          parsed = new URL(raw);
        } catch {
          this.push(path, 'INVALID_URL', 'Not a valid URL');
          return undefined;
        }
        const schemes = field.allowedSchemes ?? ['http', 'https'];
        const scheme = parsed.protocol.replace(':', '');
        if (!schemes.includes(scheme as 'http' | 'https')) {
          this.push(
            path,
            'SCHEME_NOT_ALLOWED',
            `Scheme "${scheme}" is not accepted`,
          );
        }
        return raw;
      }

      case 'phone': {
        if (typeof raw !== 'string') return this.typeError(path, 'string');
        const v = raw.trim();
        if (!PHONE_RE.test(v)) {
          this.push(path, 'INVALID_PHONE', 'Not a valid phone number');
          return undefined;
        }
        return v;
      }

      case 'date':
      case 'datetime': {
        if (typeof raw !== 'string') return this.typeError(path, 'string');
        if (field.type === 'date' && !DATE_RE.test(raw)) {
          this.push(path, 'INVALID_DATE', 'Expected format YYYY-MM-DD');
          return undefined;
        }
        const t = Date.parse(raw);
        if (Number.isNaN(t)) {
          this.push(path, 'INVALID_DATE', 'Not a valid date');
          return undefined;
        }
        if (field.min !== undefined && t < Date.parse(field.min)) {
          this.push(path, 'OUT_OF_RANGE', `Must be on or after ${field.min}`);
        }
        if (field.max !== undefined && t > Date.parse(field.max)) {
          this.push(path, 'OUT_OF_RANGE', `Must be on or before ${field.max}`);
        }
        return raw;
      }

      case 'enum': {
        if (typeof raw !== 'string') return this.typeError(path, 'string');
        if (!field.options.some((o) => o.value === raw)) {
          this.push(
            path,
            'NOT_AN_OPTION',
            `"${raw}" is not one of the accepted values`,
          );
          return undefined;
        }
        return raw;
      }

      case 'multi_enum': {
        if (!Array.isArray(raw)) return this.typeError(path, 'array');
        const allowed = new Set(field.options.map((o) => o.value));
        const picked: string[] = [];
        raw.forEach((item, i) => {
          if (typeof item !== 'string' || !allowed.has(item)) {
            this.push(
              `${path}[${i}]`,
              'NOT_AN_OPTION',
              'Not one of the accepted values',
            );
            return;
          }
          if (picked.includes(item)) {
            this.push(
              `${path}[${i}]`,
              'DUPLICATE_SELECTION',
              'Duplicate selection',
            );
            return;
          }
          picked.push(item);
        });
        if (
          field.minSelected !== undefined &&
          picked.length < field.minSelected
        ) {
          this.push(
            path,
            'TOO_FEW_SELECTED',
            `Select at least ${field.minSelected}`,
          );
        }
        if (
          field.maxSelected !== undefined &&
          picked.length > field.maxSelected
        ) {
          this.push(
            path,
            'TOO_MANY_SELECTED',
            `Select at most ${field.maxSelected}`,
          );
        }
        return picked;
      }

      case 'object': {
        if (!isRecord(raw)) return this.typeError(path, 'object');
        return this.checkFields(field.fields, raw, path, scope, depth + 1);
      }

      case 'array': {
        if (!Array.isArray(raw)) return this.typeError(path, 'array');
        if (raw.length > field.maxItems) {
          this.push(
            path,
            'TOO_MANY_ITEMS',
            `At most ${field.maxItems} items are allowed`,
          );
          return undefined;
        }
        if (field.minItems !== undefined && raw.length < field.minItems) {
          this.push(
            path,
            'TOO_FEW_ITEMS',
            `At least ${field.minItems} items are required`,
          );
        }
        return raw.map((item, i) =>
          this.checkField(field.item, item, `${path}[${i}]`, scope, depth + 1),
        );
      }

      case 'file':
        return this.checkFile(field, raw, path);

      case 'files': {
        if (!Array.isArray(raw)) return this.typeError(path, 'array');
        if (raw.length > field.maxCount) {
          this.push(
            path,
            'TOO_MANY_FILES',
            `At most ${field.maxCount} files are allowed`,
          );
          return undefined;
        }
        if (field.minCount !== undefined && raw.length < field.minCount) {
          this.push(
            path,
            'TOO_FEW_FILES',
            `At least ${field.minCount} files are required`,
          );
        }
        return raw.map((item, i) =>
          this.checkFile(field, item, `${path}[${i}]`),
        );
      }

      case 'json': {
        const encoded = JSON.stringify(raw);
        if (
          encoded !== undefined &&
          Buffer.byteLength(encoded, 'utf8') > field.maxBytes
        ) {
          this.push(path, 'TOO_LARGE', `Exceeds ${field.maxBytes} bytes`);
          return undefined;
        }
        return raw;
      }

      default:
        return undefined;
    }
  }

  private checkFile(
    field: { accept: string[]; maxSizeBytes: number },
    raw: unknown,
    path: string,
  ): unknown {
    const fileId =
      isRecord(raw) && typeof raw.fileId === 'string' ? raw.fileId : null;
    if (!fileId) {
      this.push(path, 'INVALID_FILE_REFERENCE', 'Expected { "fileId": "…" }');
      return undefined;
    }

    const files = this.opts.files;
    if (!files) {
      this.push(
        path,
        'FILE_NOT_RESOLVABLE',
        'File references cannot be resolved here',
      );
      return undefined;
    }

    const meta = files.get(fileId);
    if (!meta) {
      this.push(path, 'FILE_NOT_FOUND', 'No such uploaded file');
      return undefined;
    }
    if (this.opts.webhookId && meta.webhookId !== this.opts.webhookId) {
      // Deliberately the same error as "not found": never confirm that a file
      // belonging to another webhook exists.
      this.push(path, 'FILE_NOT_FOUND', 'No such uploaded file');
      return undefined;
    }
    if (meta.status !== 'pending') {
      this.push(
        path,
        'FILE_ALREADY_USED',
        'This file has already been attached',
      );
      return undefined;
    }
    const now = this.opts.now ?? new Date();
    if (meta.expiresAt && meta.expiresAt.getTime() < now.getTime()) {
      this.push(path, 'FILE_EXPIRED', 'This upload has expired');
      return undefined;
    }
    if (!field.accept.includes(meta.mime)) {
      this.push(
        path,
        'FILE_TYPE_NOT_ALLOWED',
        `"${meta.mime}" is not an accepted type`,
      );
      return undefined;
    }
    if (meta.sizeBytes > field.maxSizeBytes) {
      this.push(path, 'FILE_TOO_LARGE', `Exceeds ${field.maxSizeBytes} bytes`);
      return undefined;
    }

    this.fileIds.push(fileId);
    return { fileId };
  }

  private typeError(path: string, expected: string): undefined {
    this.push(path, 'INVALID_TYPE', `Expected a ${expected}`);
    return undefined;
  }

  private push(path: string, code: string, message: string): void {
    this.errors.push({ path, code, message });
  }
}

export function validatePayload(
  schema: FormSchema,
  payload: Record<string, unknown>,
  opts: ValidateOptions,
): PayloadValidationResult {
  return new PayloadChecker(schema, opts).run(payload);
}

export type { FormStep };
