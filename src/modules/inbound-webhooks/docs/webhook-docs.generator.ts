/**
 * Generates developer-facing documentation for a single inbound webhook,
 * derived entirely from its own FormSchema.
 *
 * The point is that a project developer never has to guess the contract: the
 * schema they declared is the same artefact that produces the field tables,
 * the example payload, and the JSON Schema. Documentation cannot drift from
 * validation because both read the same source.
 *
 * Pure functions — no Nest, no database — so they are trivially testable.
 */
import {
  Condition,
  Field,
  FormSchema,
  FormStep,
} from '../schema/form-schema.types';
import { evaluateCondition } from '../schema/condition.evaluator';

export interface WebhookDocsInput {
  id: string;
  name: string;
  slug: string;
  schema: FormSchema;
  acceptedOrigins: string[];
  requireSignature: boolean;
  rejectUnknownFields: boolean;
  isActive: boolean;
  createdAt: Date;
  /** Roles permitted to READ submissions, for the audience section. */
  allowedRoles: { roleId: string; roleName: string }[];
  baseUrl: string;
}

// ─── Example synthesis ────────────────────────────────────────────────────

function exampleFor(field: Field): unknown {
  switch (field.type) {
    case 'string':
      return field.pattern ? `<matching ${field.pattern}>` : 'example';
    case 'text':
      return 'A longer piece of text.';
    case 'number':
      if (field.min !== undefined) return field.min;
      return field.integer ? 42 : 42.5;
    case 'boolean':
      return true;
    case 'email':
      return field.allowedDomains?.length
        ? `someone@${field.allowedDomains[0]}`
        : 'someone@example.com';
    case 'url':
      return 'https://example.com';
    case 'phone':
      return '+213 555 123 456';
    case 'date':
      return field.min ?? '2026-01-31';
    case 'datetime':
      return field.min ?? '2026-01-31T09:00:00Z';
    case 'enum':
      return field.options[0]?.value ?? 'option';
    case 'multi_enum':
      return field.options.slice(0, field.minSelected ?? 1).map((o) => o.value);
    case 'object':
      return exampleForFields(field.fields, {});
    case 'array': {
      const count = field.minItems && field.minItems > 0 ? field.minItems : 1;
      return Array.from({ length: Math.min(count, 2) }, () =>
        exampleFor(field.item),
      );
    }
    case 'file':
      return { fileId: 'iwf_3f1c0a7e…' };
    case 'files':
      return [{ fileId: 'iwf_3f1c0a7e…' }];
    case 'json':
      return { any: 'json', under: field.maxBytes };
    default:
      return null;
  }
}

function exampleForFields(
  fields: Field[],
  scope: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    // Include a conditional field only when the example built so far actually
    // satisfies its condition — otherwise the example would not validate, and
    // the first thing a developer copies would return 422.
    if (field.condition && !evaluateCondition(field.condition, scope)) continue;
    out[field.key] = exampleFor(field);
  }
  return out;
}

/**
 * Builds a payload that would genuinely pass validation for this schema.
 *
 * Steps and fields are evaluated in order against the example accumulated so
 * far, so a branch selected earlier (say `status: "student"`) pulls in the
 * fields that branch requires.
 */
export function buildExamplePayload(
  schema: FormSchema,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const step of schema.steps) {
    if (step.condition && !evaluateCondition(step.condition, out)) continue;

    const stepOut: Record<string, unknown> = {};
    out[step.key] = stepOut;

    for (const field of step.fields) {
      if (field.condition && !evaluateCondition(field.condition, out)) continue;
      stepOut[field.key] = exampleFor(field);
    }
  }

  return out;
}

// ─── Human-readable constraints ───────────────────────────────────────────

export function describeType(field: Field): string {
  switch (field.type) {
    case 'multi_enum':
      return 'string[]';
    case 'enum':
      return 'string';
    case 'object':
      return 'object';
    case 'array':
      return `${describeType(field.item)}[]`;
    case 'file':
      return '{ fileId }';
    case 'files':
      return '{ fileId }[]';
    case 'datetime':
      return 'string (ISO 8601)';
    case 'date':
      return 'string (YYYY-MM-DD)';
    case 'text':
      return 'string';
    case 'json':
      return 'any';
    default:
      return field.type;
  }
}

export function describeConstraints(field: Field): string {
  const parts: string[] = [];

  switch (field.type) {
    case 'string':
      if (field.minLength !== undefined)
        parts.push(`min length ${field.minLength}`);
      if (field.maxLength !== undefined)
        parts.push(`max length ${field.maxLength}`);
      if (field.pattern) parts.push(`must match \`${field.pattern}\``);
      if (field.trim) parts.push('whitespace trimmed');
      break;
    case 'text':
      if (field.maxLength !== undefined)
        parts.push(`max length ${field.maxLength}`);
      break;
    case 'number':
      if (field.min !== undefined) parts.push(`min ${field.min}`);
      if (field.max !== undefined) parts.push(`max ${field.max}`);
      if (field.integer) parts.push('whole numbers only');
      parts.push('numeric strings are coerced');
      break;
    case 'email':
      if (field.allowedDomains?.length) {
        parts.push(`domain must be one of ${field.allowedDomains.join(', ')}`);
      }
      parts.push('lower-cased on accept');
      break;
    case 'url':
      parts.push(
        `scheme: ${(field.allowedSchemes ?? ['http', 'https']).join(' or ')}`,
      );
      break;
    case 'date':
    case 'datetime':
      if (field.min) parts.push(`on or after ${field.min}`);
      if (field.max) parts.push(`on or before ${field.max}`);
      break;
    case 'enum':
      parts.push(
        `one of: ${field.options.map((o) => `\`${o.value}\``).join(', ')}`,
      );
      break;
    case 'multi_enum':
      parts.push(
        `values from: ${field.options.map((o) => `\`${o.value}\``).join(', ')}`,
      );
      if (field.minSelected !== undefined)
        parts.push(`select at least ${field.minSelected}`);
      if (field.maxSelected !== undefined)
        parts.push(`select at most ${field.maxSelected}`);
      break;
    case 'array':
      if (field.minItems !== undefined)
        parts.push(`at least ${field.minItems} items`);
      parts.push(`at most ${field.maxItems} items`);
      break;
    case 'file':
      parts.push(`accepts ${field.accept.join(', ')}`);
      parts.push(`max ${formatBytes(field.maxSizeBytes)}`);
      break;
    case 'files':
      parts.push(`accepts ${field.accept.join(', ')}`);
      parts.push(`max ${formatBytes(field.maxSizeBytes)} each`);
      if (field.minCount !== undefined)
        parts.push(`at least ${field.minCount}`);
      parts.push(`at most ${field.maxCount}`);
      break;
    case 'json':
      parts.push(`max ${formatBytes(field.maxBytes)} encoded`);
      break;
    default:
      break;
  }

  if (field.default !== undefined) {
    parts.push(`defaults to \`${JSON.stringify(field.default)}\``);
  }

  return parts.join('; ') || '—';
}

export function describeCondition(condition: Condition): string {
  if (condition.op === 'and') {
    return condition.of.map(describeCondition).join(' AND ');
  }
  if (condition.op === 'or') {
    return `(${condition.of.map(describeCondition).join(' OR ')})`;
  }
  if (condition.op === 'not') {
    return `NOT (${describeCondition(condition.of)})`;
  }

  const verbs: Record<string, string> = {
    eq: 'is',
    ne: 'is not',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
    in: 'is one of',
    contains: 'contains',
    exists: 'is present',
  };
  const verb = verbs[condition.op] ?? condition.op;
  if (condition.op === 'exists') return `\`${condition.field}\` ${verb}`;
  return `\`${condition.field}\` ${verb} \`${JSON.stringify(condition.value)}\``;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024)
    return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} bytes`;
}

// ─── Markdown ─────────────────────────────────────────────────────────────

function fieldRows(fields: Field[], prefix: string, out: string[]): void {
  for (const field of fields) {
    const name = prefix ? `${prefix}.${field.key}` : field.key;
    const required = field.required ? '**yes**' : 'no';
    const when = field.condition
      ? ` _(only when ${describeCondition(field.condition)})_`
      : '';
    out.push(
      `| \`${name}\` | ${describeType(field)} | ${required} | ${describeConstraints(field)}${when} |`,
    );

    if (field.type === 'object') fieldRows(field.fields, name, out);
    if (field.type === 'array') {
      // The item's own `key` is a schema artefact, not a payload key: array
      // elements ARE the item. Inline its children so the documented path
      // matches what the caller actually sends.
      if (field.item.type === 'object') {
        fieldRows(field.item.fields, `${name}[]`, out);
      } else {
        fieldRows([field.item], `${name}[]`, out);
      }
    }
  }
}

function stepSection(step: FormStep, index: number): string {
  const lines: string[] = [];
  lines.push(
    `### ${index + 1}. \`${step.key}\`${step.title ? ` — ${step.title}` : ''}`,
  );
  lines.push('');
  if (step.description) {
    lines.push(step.description);
    lines.push('');
  }
  if (step.condition) {
    lines.push(
      `> This whole step is skipped unless ${describeCondition(step.condition)}. ` +
        'Its fields are then neither required nor stored.',
    );
    lines.push('');
  }
  lines.push('| Field | Type | Required | Constraints |');
  lines.push('| --- | --- | --- | --- |');
  const rows: string[] = [];
  fieldRows(step.fields, '', rows);
  lines.push(...rows);
  lines.push('');
  return lines.join('\n');
}

/** Picks a real required field, so the 422 example is not a placeholder. */
function sampleErrorPath(schema: FormSchema): string {
  for (const step of schema.steps) {
    for (const field of step.fields) {
      if (field.required) return `${step.key}.${field.key}`;
    }
  }
  const step = schema.steps[0];
  const field = step?.fields[0];
  return step && field ? `${step.key}.${field.key}` : 'step.field';
}

export function renderMarkdown(input: WebhookDocsInput): string {
  const url = `${input.baseUrl.replace(/\/$/, '')}/inbound-webhooks/${input.id}/submit`;
  const example = buildExamplePayload(input.schema);
  const exampleJson = JSON.stringify(example, null, 2);
  const compactJson = JSON.stringify(example);

  const md: string[] = [];

  md.push(`# ${input.name}`);
  md.push('');
  md.push(
    `Inbound webhook \`${input.slug}\` — send structured submissions to MCDI.`,
  );
  md.push('');
  if (!input.isActive) {
    md.push(
      '> **This webhook is currently inactive.** Submissions are rejected with `410 Gone`.',
    );
    md.push('');
  }
  md.push('| | |');
  md.push('| --- | --- |');
  md.push(`| Endpoint | \`POST ${url}\` |`);
  md.push(`| Webhook ID | \`${input.id}\` |`);
  md.push(
    `| Authentication | Project API key (\`Authorization: Bearer <key>\`) |`,
  );
  md.push(
    `| Signature | ${input.requireSignature ? '**required**' : 'not required'} |`,
  );
  md.push(
    `| Allowed origins | ${
      input.acceptedOrigins.length
        ? input.acceptedOrigins.map((o) => `\`${o}\``).join(', ')
        : 'any'
    } |`,
  );
  md.push(
    `| Unknown fields | ${input.rejectUnknownFields ? 'rejected' : 'silently stripped'} |`,
  );
  md.push(`| Created | ${input.createdAt.toISOString().slice(0, 10)} |`);
  md.push('');

  md.push('---');
  md.push('');
  md.push('## 1. Before you start');
  md.push('');
  md.push(
    'This endpoint is **server-to-server**. It authenticates with your project API key, ' +
      'which must never reach a browser — call it from your own backend, not from a public form.',
  );
  md.push('');
  md.push('You need two secrets, both issued once and never shown again:');
  md.push('');
  md.push(
    '- **API key** — `pk_xxxx.<secret>`, issued when your project was created',
  );
  if (input.requireSignature) {
    md.push(
      '- **Signing secret** — `whsec_…`, issued when this webhook was created',
    );
  }
  md.push('');
  md.push('If either is lost, ask an administrator to rotate it.');
  md.push('');

  md.push('## 2. The payload');
  md.push('');
  md.push(
    `The body is a JSON object keyed by **step**, then by **field**. ` +
      `This webhook declares ${input.schema.steps.length} step${input.schema.steps.length === 1 ? '' : 's'}.`,
  );
  md.push('');
  md.push('```json');
  md.push(exampleJson);
  md.push('```');
  md.push('');
  md.push(
    '> This example satisfies the schema as written: a conditional field appears only because the ' +
      'branch chosen above activates it. Pick a different branch and a different set of fields ' +
      'applies — the table below gives every condition.',
  );
  md.push('');

  md.push('## 3. Fields');
  md.push('');
  input.schema.steps.forEach((step, i) => md.push(stepSection(step, i)));

  if (input.requireSignature) {
    md.push('## 4. Signing the request');
    md.push('');
    md.push('Every request carries an HMAC signature over the **raw body**:');
    md.push('');
    md.push('```');
    md.push('X-MCDI-Signature: t=<unix seconds>,v1=<hex hmac-sha256>');
    md.push('```');
    md.push('');
    md.push(
      'The signed string is `"<t>.<raw body>"` — the exact bytes you transmit.',
    );
    md.push('');
    md.push(
      '**Serialise once and sign that string.** Re-serialising the parsed object changes ' +
        'key order and whitespace, and the signature will not verify.',
    );
    md.push('');
    md.push(
      'Requests older than 5 minutes are rejected, and a signature may only be used once.',
    );
    md.push('');
    md.push('### Node.js');
    md.push('');
    md.push('```js');
    md.push("import { createHmac } from 'crypto';");
    md.push('');
    md.push(`const body = JSON.stringify(${compactJson});`);
    md.push('const t = Math.floor(Date.now() / 1000);');
    md.push("const v1 = createHmac('sha256', process.env.MCDI_SIGNING_SECRET)");
    md.push('  .update(`${t}.${body}`)');
    md.push("  .digest('hex');");
    md.push('');
    md.push(`const res = await fetch('${url}', {`);
    md.push("  method: 'POST',");
    md.push('  headers: {');
    md.push("    'Content-Type': 'application/json',");
    md.push('    Authorization: `Bearer ${process.env.MCDI_API_KEY}`,');
    md.push("    'X-MCDI-Signature': `t=${t},v1=${v1}`,");
    md.push('  },');
    md.push('  body, // the same string that was signed');
    md.push('});');
    md.push('```');
    md.push('');
    md.push('### Python');
    md.push('');
    md.push('```python');
    md.push('import hmac, hashlib, json, os, time, requests');
    md.push('');
    md.push(`body = json.dumps(${compactJson}, separators=(",", ":"))`);
    md.push('t = int(time.time())');
    md.push('v1 = hmac.new(');
    md.push('    os.environ["MCDI_SIGNING_SECRET"].encode(),');
    md.push('    f"{t}.{body}".encode(),');
    md.push('    hashlib.sha256,');
    md.push(').hexdigest()');
    md.push('');
    md.push('requests.post(');
    md.push(`    "${url}",`);
    md.push('    data=body,  # the same bytes that were signed');
    md.push('    headers={');
    md.push('        "Content-Type": "application/json",');
    md.push(
      '        "Authorization": f"Bearer {os.environ[\'MCDI_API_KEY\']}",',
    );
    md.push('        "X-MCDI-Signature": f"t={t},v1={v1}",');
    md.push('    },');
    md.push(')');
    md.push('```');
    md.push('');
  } else {
    md.push('## 4. Sending a request');
    md.push('');
    md.push('This webhook does not require a signature.');
    md.push('');
    md.push('```bash');
    md.push(`curl -X POST '${url}' \\`);
    md.push("  -H 'Content-Type: application/json' \\");
    md.push('  -H "Authorization: Bearer $MCDI_API_KEY" \\');
    md.push(`  -d '${compactJson}'`);
    md.push('```');
    md.push('');
  }

  md.push('## 5. Responses');
  md.push('');
  md.push('A successful submission returns `201`:');
  md.push('');
  md.push('```json');
  md.push('{ "id": "0b7f…", "receivedAt": "2026-01-31T09:00:00.000Z" }');
  md.push('```');
  md.push('');
  md.push(
    'A validation failure returns `422` with **every** problem at once, so you never',
  );
  md.push('have to fix them one request at a time:');
  md.push('');
  md.push('```json');
  md.push(
    JSON.stringify(
      {
        statusCode: 422,
        error: 'ValidationFailed',
        errors: [
          {
            path: sampleErrorPath(input.schema),
            code: 'REQUIRED',
            message: 'Field is required',
          },
        ],
      },
      null,
      2,
    ),
  );
  md.push('```');
  md.push('');
  md.push('| Status | Meaning | What to do |');
  md.push('| --- | --- | --- |');
  md.push('| `201` | Accepted | — |');
  md.push(
    '| `401` | Bad or stale signature | Check the secret, and that the clock is accurate |',
  );
  md.push('| `403` | Origin not allowed | Call from a permitted origin |');
  md.push(
    '| `404` | No such webhook for your project | Check the webhook ID and the API key match |',
  );
  md.push(
    '| `409` | Signature already used | Generate a fresh timestamp per request |',
  );
  md.push(
    '| `410` | Webhook inactive | Ask an administrator to re-enable it |',
  );
  md.push(
    '| `422` | Payload failed validation | Fix the fields listed in `errors` |',
  );
  md.push('| `429` | Rate limited | Back off and retry |');
  md.push('');

  md.push('## 6. Who can read submissions');
  md.push('');
  md.push(
    'Submissions are **not** readable with your API key. They are readable only by Discord ' +
      'members holding one of these roles, signed in with a session:',
  );
  md.push('');
  if (input.allowedRoles.length === 0) {
    md.push('- _(none recorded)_');
  } else {
    for (const role of input.allowedRoles) {
      md.push(`- **${role.roleName}** (\`${role.roleId}\`)`);
    }
  }
  md.push('');
  md.push(
    'Every read is recorded in the audit log. Losing the role removes access immediately.',
  );
  md.push('');
  md.push('---');
  md.push('');
  md.push(
    `_Generated from the live schema on ${new Date().toISOString().slice(0, 10)}._`,
  );
  md.push('');

  return md.join('\n');
}

// ─── OpenAPI ──────────────────────────────────────────────────────────────

export function fieldToJsonSchema(field: Field): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (field.label) base.title = field.label;
  if (field.description) base.description = field.description;
  if (field.default !== undefined) base.default = field.default;

  switch (field.type) {
    case 'string':
      return {
        ...base,
        type: 'string',
        minLength: field.minLength,
        maxLength: field.maxLength,
        pattern: field.pattern,
      };
    case 'text':
      return { ...base, type: 'string', maxLength: field.maxLength };
    case 'number':
      return {
        ...base,
        type: field.integer ? 'integer' : 'number',
        minimum: field.min,
        maximum: field.max,
      };
    case 'boolean':
      return { ...base, type: 'boolean' };
    case 'email':
      return { ...base, type: 'string', format: 'email' };
    case 'url':
      return { ...base, type: 'string', format: 'uri' };
    case 'phone':
      return { ...base, type: 'string' };
    case 'date':
      return { ...base, type: 'string', format: 'date' };
    case 'datetime':
      return { ...base, type: 'string', format: 'date-time' };
    case 'enum':
      return {
        ...base,
        type: 'string',
        enum: field.options.map((o) => o.value),
      };
    case 'multi_enum':
      return {
        ...base,
        type: 'array',
        items: { type: 'string', enum: field.options.map((o) => o.value) },
        minItems: field.minSelected,
        maxItems: field.maxSelected,
        uniqueItems: true,
      };
    case 'object':
      return { ...base, ...fieldsToJsonSchema(field.fields) };
    case 'array':
      return {
        ...base,
        type: 'array',
        items: fieldToJsonSchema(field.item),
        minItems: field.minItems,
        maxItems: field.maxItems,
      };
    case 'file':
      return {
        ...base,
        type: 'object',
        properties: { fileId: { type: 'string' } },
        required: ['fileId'],
        description: `Uploaded file reference. Accepts ${field.accept.join(', ')}.`,
      };
    case 'files':
      return {
        ...base,
        type: 'array',
        maxItems: field.maxCount,
        minItems: field.minCount,
        items: {
          type: 'object',
          properties: { fileId: { type: 'string' } },
          required: ['fileId'],
        },
      };
    case 'json':
      return {
        ...base,
        description: `Arbitrary JSON, at most ${field.maxBytes} bytes encoded.`,
      };
    default:
      return base;
  }
}

function fieldsToJsonSchema(fields: Field[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.key] = fieldToJsonSchema(field);
    // A conditionally-required field cannot be marked required unconditionally.
    if (field.required && !field.condition) required.push(field.key);
  }

  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}

export function renderOpenApi(
  input: WebhookDocsInput,
): Record<string, unknown> {
  const path = `/inbound-webhooks/${input.id}/submit`;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const step of input.schema.steps) {
    properties[step.key] = fieldsToJsonSchema(step.fields);
    if (!step.condition) required.push(step.key);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${input.name} — inbound webhook`,
      version: '1.0.0',
      description:
        `Generated from the live schema of inbound webhook \`${input.slug}\`. ` +
        'Server-to-server only: the API key must not reach a browser.',
    },
    servers: [{ url: input.baseUrl.replace(/\/$/, '') }],
    paths: {
      [path]: {
        post: {
          summary: `Submit to ${input.name}`,
          operationId: 'submit',
          security: [{ apiKey: [] }],
          parameters: input.requireSignature
            ? [
                {
                  name: 'X-MCDI-Signature',
                  in: 'header',
                  required: true,
                  schema: { type: 'string' },
                  description:
                    't=<unix seconds>,v1=<hex hmac-sha256 of "t.<raw body>">',
                },
              ]
            : [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties,
                  ...(required.length ? { required } : {}),
                },
                example: buildExamplePayload(input.schema),
              },
            },
          },
          responses: {
            '201': { description: 'Accepted' },
            '401': { description: 'Bad or stale signature' },
            '403': { description: 'Origin not permitted' },
            '404': { description: 'No such webhook for this project' },
            '409': { description: 'Signature replayed' },
            '410': { description: 'Webhook inactive' },
            '422': {
              description: 'Payload failed validation; every error is listed',
            },
            '429': { description: 'Rate limited' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'Project API key',
        },
      },
    },
  };
}
