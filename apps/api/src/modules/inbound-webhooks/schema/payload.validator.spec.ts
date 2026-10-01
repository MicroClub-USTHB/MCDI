import { validatePayload, FileMeta } from './payload.validator';
import type { Field, FormSchema } from './form-schema.types';

const opts = { rejectUnknownFields: true };

const build = (fields: Field[]): FormSchema => ({
  version: 1,
  steps: [{ key: 'step', fields }],
});

const errs = (r: ReturnType<typeof validatePayload>) => (r.ok ? [] : r.errors);
const codes = (r: ReturnType<typeof validatePayload>) =>
  errs(r).map((e) => e.code);
const paths = (r: ReturnType<typeof validatePayload>) =>
  errs(r).map((e) => e.path);

describe('validatePayload (Layer 2)', () => {
  describe('required and defaults', () => {
    const schema = build([
      { key: 'a', type: 'string', required: true },
      { key: 'b', type: 'string', required: false, default: 'fallback' },
    ]);

    it('accepts a complete payload', () => {
      const r = validatePayload(schema, { step: { a: 'x' } }, opts);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ step: { a: 'x', b: 'fallback' } });
    });

    it('reports a missing required field', () => {
      const r = validatePayload(schema, { step: {} }, opts);
      expect(codes(r)).toEqual(['REQUIRED']);
      expect(paths(r)).toEqual(['step.a']);
    });

    it('treats empty string as absent', () => {
      expect(codes(validatePayload(schema, { step: { a: '' } }, opts))).toEqual(
        ['REQUIRED'],
      );
    });
  });

  describe('unknown keys', () => {
    const schema = build([{ key: 'a', type: 'string', required: false }]);

    it('rejects an unknown field when configured to', () => {
      const r = validatePayload(schema, { step: { a: 'x', zzz: 1 } }, opts);
      expect(codes(r)).toEqual(['UNKNOWN_FIELD']);
    });

    it('strips an unknown field when not configured to reject', () => {
      const r = validatePayload(
        schema,
        { step: { a: 'x', zzz: 1 } },
        { rejectUnknownFields: false },
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual({ step: { a: 'x' } });
    });

    it('rejects an unknown step', () => {
      expect(codes(validatePayload(schema, { nope: {} }, opts))).toContain(
        'UNKNOWN_STEP',
      );
    });
  });

  describe('string', () => {
    const schema = build([
      {
        key: 's',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 5,
        trim: true,
        pattern: '^[a-z]+$',
      },
    ]);
    it('trims', () => {
      const r = validatePayload(schema, { step: { s: '  abc  ' } }, opts);
      if (r.ok) expect(r.value).toEqual({ step: { s: 'abc' } });
      else throw new Error(JSON.stringify(r.errors));
    });
    it('enforces minLength', () => {
      expect(
        codes(validatePayload(schema, { step: { s: 'a' } }, opts)),
      ).toContain('TOO_SHORT');
    });
    it('enforces maxLength', () => {
      expect(
        codes(validatePayload(schema, { step: { s: 'abcdefgh' } }, opts)),
      ).toContain('TOO_LONG');
    });
    it('enforces the pattern', () => {
      expect(
        codes(validatePayload(schema, { step: { s: 'AB9' } }, opts)),
      ).toContain('PATTERN_MISMATCH');
    });
    it('rejects a non-string', () => {
      expect(
        codes(validatePayload(schema, { step: { s: 42 } }, opts)),
      ).toContain('INVALID_TYPE');
    });
    it('does not run the pattern on a value that is already too long', () => {
      expect(
        codes(validatePayload(schema, { step: { s: 'ABCDEFGH' } }, opts)),
      ).toEqual(['TOO_LONG']);
    });
  });

  describe('string — catastrophic pattern', () => {
    const schema = build([
      { key: 's', type: 'string', required: true, pattern: '(a+)+$' },
      { key: 'n', type: 'number', required: true },
    ]);
    const evil = 'a'.repeat(40) + '!';

    it('interrupts the pattern instead of blocking the event loop', () => {
      const started = Date.now();
      const r = validatePayload(schema, { step: { s: evil, n: 1 } }, opts);
      expect(Date.now() - started).toBeLessThan(1000);
      expect(codes(r)).toEqual(['PATTERN_TIMEOUT']);
      expect(paths(r)).toEqual(['step.s']);
    });

    it('stops validating at the timeout but keeps earlier errors', () => {
      const r = validatePayload(
        build([
          { key: 'first', type: 'number', required: true },
          { key: 's', type: 'string', required: true, pattern: '(a+)+$' },
          { key: 'last', type: 'number', required: true },
        ]),
        { step: { first: 'x', s: evil, last: 'x' } },
        opts,
      );
      expect(codes(r)).toEqual(['INVALID_TYPE', 'PATTERN_TIMEOUT']);
    });

    it('still validates normally after a timeout', () => {
      validatePayload(schema, { step: { s: evil, n: 1 } }, opts);
      expect(
        validatePayload(schema, { step: { s: 'aaa', n: 1 } }, opts).ok,
      ).toBe(true);
    });
  });

  describe('number', () => {
    const schema = build([
      {
        key: 'n',
        type: 'number',
        required: true,
        min: 0,
        max: 60,
        integer: true,
      },
    ]);
    it('coerces a numeric string', () => {
      const r = validatePayload(schema, { step: { n: '25' } }, opts);
      if (r.ok) expect(r.value).toEqual({ step: { n: 25 } });
      else throw new Error(JSON.stringify(r.errors));
    });
    it('rejects a non-numeric string', () => {
      expect(
        codes(validatePayload(schema, { step: { n: 'abc' } }, opts)),
      ).toContain('INVALID_TYPE');
    });
    it('rejects NaN and Infinity', () => {
      expect(
        codes(validatePayload(schema, { step: { n: Infinity } }, opts)),
      ).toContain('INVALID_TYPE');
    });
    it('enforces the range', () => {
      expect(
        codes(validatePayload(schema, { step: { n: 99 } }, opts)),
      ).toContain('OUT_OF_RANGE');
    });
    it('enforces integer', () => {
      expect(
        codes(validatePayload(schema, { step: { n: 1.5 } }, opts)),
      ).toContain('NOT_AN_INTEGER');
    });
  });

  describe('boolean', () => {
    const schema = build([{ key: 'b', type: 'boolean', required: true }]);
    it('accepts real booleans and string forms', () => {
      expect(validatePayload(schema, { step: { b: true } }, opts).ok).toBe(
        true,
      );
      const r = validatePayload(schema, { step: { b: 'false' } }, opts);
      if (r.ok) expect(r.value).toEqual({ step: { b: false } });
    });
    it('rejects anything else', () => {
      expect(
        codes(validatePayload(schema, { step: { b: 'maybe' } }, opts)),
      ).toContain('INVALID_TYPE');
    });
  });

  describe('email', () => {
    const schema = build([
      { key: 'e', type: 'email', required: true, allowedDomains: ['usthb.dz'] },
    ]);
    it('normalises case', () => {
      const r = validatePayload(schema, { step: { e: 'Ada@USTHB.dz' } }, opts);
      if (r.ok) expect(r.value).toEqual({ step: { e: 'ada@usthb.dz' } });
      else throw new Error(JSON.stringify(r.errors));
    });
    it('rejects a malformed address', () => {
      expect(
        codes(validatePayload(schema, { step: { e: 'nope' } }, opts)),
      ).toContain('INVALID_EMAIL');
    });
    it('enforces the domain allowlist', () => {
      expect(
        codes(validatePayload(schema, { step: { e: 'a@gmail.com' } }, opts)),
      ).toContain('DOMAIN_NOT_ALLOWED');
    });
    it('rejects an address longer than 254 characters', () => {
      const e = `${'a'.repeat(250)}@usthb.dz`;
      expect(codes(validatePayload(schema, { step: { e } }, opts))).toEqual([
        'INVALID_EMAIL',
      ]);
    });
    it('rejects an empty domain label', () => {
      const anyDomain = build([{ key: 'e', type: 'email', required: true }]);
      for (const e of ['a@b..c', 'a@b.c.']) {
        expect(
          codes(validatePayload(anyDomain, { step: { e } }, opts)),
        ).toEqual(['INVALID_EMAIL']);
      }
    });
    it('accepts a subdomain address', () => {
      const anyDomain = build([{ key: 'e', type: 'email', required: true }]);
      expect(
        validatePayload(anyDomain, { step: { e: 'a.b@mail.usthb.dz' } }, opts)
          .ok,
      ).toBe(true);
    });
  });

  describe('url, phone, date', () => {
    it('rejects a bad url and a disallowed scheme', () => {
      const schema = build([
        { key: 'u', type: 'url', required: true, allowedSchemes: ['https'] },
      ]);
      expect(
        codes(validatePayload(schema, { step: { u: 'not a url' } }, opts)),
      ).toContain('INVALID_URL');
      expect(
        codes(validatePayload(schema, { step: { u: 'http://x.com' } }, opts)),
      ).toContain('SCHEME_NOT_ALLOWED');
      expect(
        validatePayload(schema, { step: { u: 'https://x.com' } }, opts).ok,
      ).toBe(true);
    });

    it('validates phone shape', () => {
      const schema = build([{ key: 'p', type: 'phone', required: true }]);
      expect(
        validatePayload(schema, { step: { p: '+213 555 123 456' } }, opts).ok,
      ).toBe(true);
      expect(
        codes(validatePayload(schema, { step: { p: 'call me' } }, opts)),
      ).toContain('INVALID_PHONE');
    });

    it('validates date format and bounds', () => {
      const schema = build([
        { key: 'd', type: 'date', required: true, max: '2010-01-01' },
      ]);
      expect(
        validatePayload(schema, { step: { d: '2000-05-04' } }, opts).ok,
      ).toBe(true);
      expect(
        codes(validatePayload(schema, { step: { d: '04/05/2000' } }, opts)),
      ).toContain('INVALID_DATE');
      expect(
        codes(validatePayload(schema, { step: { d: '2020-01-01' } }, opts)),
      ).toContain('OUT_OF_RANGE');
    });
  });

  describe('enum and multi_enum', () => {
    it('rejects a value outside the options', () => {
      const schema = build([
        { key: 'e', type: 'enum', required: true, options: [{ value: 'a' }] },
      ]);
      expect(
        codes(validatePayload(schema, { step: { e: 'b' } }, opts)),
      ).toContain('NOT_AN_OPTION');
    });

    it('enforces selection counts and rejects duplicates', () => {
      const schema = build([
        {
          key: 'm',
          type: 'multi_enum',
          required: true,
          options: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
          minSelected: 2,
          maxSelected: 2,
        },
      ]);
      expect(
        validatePayload(schema, { step: { m: ['a', 'b'] } }, opts).ok,
      ).toBe(true);
      expect(
        codes(validatePayload(schema, { step: { m: ['a'] } }, opts)),
      ).toContain('TOO_FEW_SELECTED');
      expect(
        codes(validatePayload(schema, { step: { m: ['a', 'a'] } }, opts)),
      ).toContain('DUPLICATE_SELECTION');
      expect(
        codes(validatePayload(schema, { step: { m: ['a', 'z'] } }, opts)),
      ).toContain('NOT_AN_OPTION');
    });
  });

  describe('object and array nesting', () => {
    const schema = build([
      {
        key: 'experience',
        type: 'array',
        required: true,
        maxItems: 3,
        minItems: 1,
        item: {
          key: 'entry',
          type: 'object',
          required: true,
          fields: [
            { key: 'company', type: 'string', required: true },
            { key: 'years', type: 'number', required: true, min: 0, max: 60 },
          ],
        },
      },
    ]);

    it('validates each element', () => {
      const r = validatePayload(
        schema,
        {
          step: {
            experience: [
              { company: 'A', years: 3 },
              { company: 'B', years: 5 },
            ],
          },
        },
        opts,
      );
      expect(r.ok).toBe(true);
    });

    it('locates an error inside an array element by index', () => {
      const r = validatePayload(
        schema,
        {
          step: {
            experience: [
              { company: 'A', years: 3 },
              { company: 'B', years: 99 },
            ],
          },
        },
        opts,
      );
      expect(paths(r)).toEqual(['step.experience[1].years']);
      expect(codes(r)).toEqual(['OUT_OF_RANGE']);
    });

    it('enforces maxItems and minItems', () => {
      const many = Array.from({ length: 5 }, () => ({
        company: 'A',
        years: 1,
      }));
      expect(
        codes(validatePayload(schema, { step: { experience: many } }, opts)),
      ).toContain('TOO_MANY_ITEMS');
      expect(
        codes(validatePayload(schema, { step: { experience: [] } }, opts)),
      ).toContain('TOO_FEW_ITEMS');
    });

    it('rejects a non-array', () => {
      expect(
        codes(validatePayload(schema, { step: { experience: 'x' } }, opts)),
      ).toContain('INVALID_TYPE');
    });
  });

  describe('json', () => {
    it('enforces the byte cap', () => {
      const schema = build([
        { key: 'j', type: 'json', required: true, maxBytes: 20 },
      ]);
      expect(validatePayload(schema, { step: { j: { a: 1 } } }, opts).ok).toBe(
        true,
      );
      expect(
        codes(
          validatePayload(
            schema,
            { step: { j: { a: 'x'.repeat(100) } } },
            opts,
          ),
        ),
      ).toContain('TOO_LARGE');
    });
  });

  describe('conditions — the ordering rule', () => {
    const schema: FormSchema = {
      version: 1,
      steps: [
        {
          key: 'identity',
          fields: [
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
          ],
        },
      ],
    };

    it('enforces a required field when its condition holds', () => {
      const r = validatePayload(
        schema,
        { identity: { status: 'student' }, background: {} },
        opts,
      );
      expect(codes(r)).toEqual(['REQUIRED']);
      expect(paths(r)).toEqual(['background.university']);
    });

    it('does NOT enforce a required field when its condition is false', () => {
      const r = validatePayload(
        schema,
        { identity: { status: 'pro' }, background: {} },
        opts,
      );
      expect(r.ok).toBe(true);
    });

    it('strips a value sent for a condition-inactive field', () => {
      const r = validatePayload(
        schema,
        {
          identity: { status: 'pro' },
          background: { university: 'sneaked in' },
        },
        opts,
      );
      expect(r.ok).toBe(true);
      if (r.ok)
        expect(r.value).toEqual({
          identity: { status: 'pro' },
          background: {},
        });
    });

    it('skips an entire step whose condition is false', () => {
      const stepped: FormSchema = {
        version: 1,
        steps: [
          schema.steps[0],
          {
            ...schema.steps[1],
            condition: { op: 'eq', field: 'identity.status', value: 'student' },
            fields: [{ key: 'university', type: 'string', required: true }],
          },
        ],
      };
      expect(
        validatePayload(stepped, { identity: { status: 'pro' } }, opts).ok,
      ).toBe(true);
      expect(
        codes(
          validatePayload(stepped, { identity: { status: 'student' } }, opts),
        ),
      ).toEqual(['REQUIRED']);
    });
  });

  describe('files', () => {
    const schema = build([
      {
        key: 'cv',
        type: 'file',
        required: true,
        accept: ['application/pdf'],
        maxSizeBytes: 1000,
      },
    ]);
    const now = new Date('2026-01-01T00:00:00Z');
    const meta = (over: Partial<FileMeta> = {}): FileMeta => ({
      id: 'f1',
      webhookId: 'w1',
      mime: 'application/pdf',
      sizeBytes: 500,
      status: 'pending',
      expiresAt: new Date('2026-01-02T00:00:00Z'),
      ...over,
    });
    const withFiles = (m: FileMeta) => ({
      ...opts,
      files: new Map([[m.id, m]]),
      webhookId: 'w1',
      now,
    });

    it('accepts a valid reference and reports the file id', () => {
      const r = validatePayload(
        schema,
        { step: { cv: { fileId: 'f1' } } },
        withFiles(meta()),
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.fileIds).toEqual(['f1']);
    });

    it('rejects a malformed reference', () => {
      expect(
        codes(
          validatePayload(schema, { step: { cv: 'f1' } }, withFiles(meta())),
        ),
      ).toContain('INVALID_FILE_REFERENCE');
    });

    it('rejects an unknown file', () => {
      expect(
        codes(
          validatePayload(
            schema,
            { step: { cv: { fileId: 'other' } } },
            withFiles(meta()),
          ),
        ),
      ).toContain('FILE_NOT_FOUND');
    });

    it('reports a file from another webhook as NOT_FOUND, never as forbidden', () => {
      const r = validatePayload(
        schema,
        { step: { cv: { fileId: 'f1' } } },
        withFiles(meta({ webhookId: 'w2' })),
      );
      expect(codes(r)).toEqual(['FILE_NOT_FOUND']);
    });

    it('rejects an already-committed file', () => {
      expect(
        codes(
          validatePayload(
            schema,
            { step: { cv: { fileId: 'f1' } } },
            withFiles(meta({ status: 'committed' })),
          ),
        ),
      ).toContain('FILE_ALREADY_USED');
    });

    it('rejects an expired upload', () => {
      expect(
        codes(
          validatePayload(
            schema,
            { step: { cv: { fileId: 'f1' } } },
            withFiles(meta({ expiresAt: new Date('2025-12-31T00:00:00Z') })),
          ),
        ),
      ).toContain('FILE_EXPIRED');
    });

    it('rejects a disallowed mime type', () => {
      expect(
        codes(
          validatePayload(
            schema,
            { step: { cv: { fileId: 'f1' } } },
            withFiles(meta({ mime: 'image/png' })),
          ),
        ),
      ).toContain('FILE_TYPE_NOT_ALLOWED');
    });

    it('rejects an oversize file', () => {
      expect(
        codes(
          validatePayload(
            schema,
            { step: { cv: { fileId: 'f1' } } },
            withFiles(meta({ sizeBytes: 99999 })),
          ),
        ),
      ).toContain('FILE_TOO_LARGE');
    });
  });

  describe('onlyStep', () => {
    const schema: FormSchema = {
      version: 1,
      steps: [
        { key: 'one', fields: [{ key: 'a', type: 'string', required: true }] },
        { key: 'two', fields: [{ key: 'b', type: 'string', required: true }] },
      ],
    };

    it('validates just the named step', () => {
      const r = validatePayload(
        schema,
        { one: { a: 'x' } },
        { ...opts, onlyStep: 'one' },
      );
      expect(r.ok).toBe(true);
    });

    it('rejects an unknown step name', () => {
      expect(
        codes(validatePayload(schema, {}, { ...opts, onlyStep: 'nope' })),
      ).toEqual(['UNKNOWN_STEP']);
    });
  });

  it('reports every error at once', () => {
    const schema = build([
      { key: 'a', type: 'string', required: true },
      { key: 'b', type: 'number', required: true, max: 5 },
      { key: 'c', type: 'email', required: true },
    ]);
    const r = validatePayload(schema, { step: { b: 99, c: 'nope' } }, opts);
    expect(codes(r).sort()).toEqual([
      'INVALID_EMAIL',
      'OUT_OF_RANGE',
      'REQUIRED',
    ]);
  });
});
