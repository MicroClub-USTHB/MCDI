import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyConfig, loadConfig, saveConfig, setSession } from './config.js';
import { decrypt, encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import {
  slugFromName,
  webhookCreate,
  webhookDelete,
  webhookGet,
  webhookList,
  webhookRolesSet,
  webhookSecretGet,
  webhookUpdate,
  type WebhookDeps,
} from './webhook-flow.js';

/**
 * A stand-in for MCDI's `/api/admin/inbound-webhooks` routes, with shapes from
 * MicroClub-USTHB/MCDI apps/api/src/modules/inbound-webhooks
 * (inbound-webhooks.controller.ts, InboundWebhookRow in the repository).
 */
interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  authorization: string | undefined;
  body: unknown;
}

interface FakeMcdi {
  baseUrl: string;
  requests: RecordedRequest[];
  webhooks: Record<string, unknown>[];
  /** Forces every response to this status/body when set. */
  fail: { status: number; body: unknown } | undefined;
  close(): Promise<void>;
}

const TOKEN = 'session-token-'.padEnd(64, 'x');
/** Never returned by the real API; the fake slips it in to prove mcdi-cli drops unknown fields. */
const LEAKED_SECRET = 'whsec_must_never_be_printed';
/** What the fake returns as a new webhook's signing secret. */
const CREATED_SECRET = 'whsec_created_once_cccccccccccccccc9999';

function webhookRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'wh-1',
    projectId: 'proj-1',
    name: 'Recruitment form',
    slug: 'recruitment',
    schema: { version: 1, steps: [{ id: 'about', fields: [{ key: 'email', type: 'email', label: 'Email' }] }] },
    acceptedOrigins: [],
    requireSignature: true,
    rejectUnknownFields: true,
    allowRoleInheritance: false,
    isActive: true,
    submissionCount: 3,
    lastSubmissionAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    signingSecretEnc: LEAKED_SECRET,
    ...overrides,
  };
}

async function startFakeMcdi(): Promise<FakeMcdi> {
  const fake: FakeMcdi = {
    baseUrl: '',
    requests: [],
    webhooks: [webhookRow(), webhookRow({ id: 'wh-2', projectId: 'proj-2', name: 'Feedback', slug: 'feedback', isActive: false, submissionCount: 0 })],
    fail: undefined,
    close: async () => {},
  };
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const json = (status: number, body?: unknown) => {
        if (body === undefined) return res.writeHead(status).end();
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      };
      fake.requests.push({
        method: req.method ?? '',
        path: url.pathname,
        query: url.searchParams,
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : undefined,
      });

      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        return json(401, { statusCode: 401, message: 'Invalid or expired session', error: 'Unauthorized' });
      }
      if (fake.fail) return json(fake.fail.status, fake.fail.body);

      if (url.pathname === '/api/admin/inbound-webhooks' && req.method === 'POST') {
        const body = fake.requests.at(-1)!.body as Record<string, unknown>;
        if (fake.webhooks.some((w) => w.projectId === body.projectId && w.slug === body.slug)) {
          return json(409, { statusCode: 409, message: `Project already has a webhook with slug "${String(body.slug)}"`, error: 'Conflict' });
        }
        const webhook = webhookRow({
          id: 'wh-new',
          projectId: body.projectId,
          name: body.name,
          slug: body.slug,
          schema: body.schema,
          acceptedOrigins: body.acceptedOrigins ?? [],
          submissionCount: 0,
        });
        fake.webhooks.push(webhook);
        return json(201, {
          webhook,
          signingSecret: CREATED_SECRET,
          allowedRoleIds: body.allowedRoleIds,
          submitUrl: `${fake.baseUrl}/api/inbound-webhooks/wh-new/submit`,
          docsUrl: `${fake.baseUrl}/api/admin/inbound-webhooks/wh-new/docs`,
        });
      }
      if (url.pathname === '/api/admin/inbound-webhooks' && req.method === 'GET') {
        const projectId = url.searchParams.get('projectId');
        return json(200, projectId ? fake.webhooks.filter((w) => w.projectId === projectId) : fake.webhooks);
      }
      const roles = url.pathname.match(/^\/api\/admin\/inbound-webhooks\/([^/]+)\/roles$/);
      if (roles && req.method === 'PUT') {
        if (!fake.webhooks.some((w) => w.id === decodeURIComponent(roles[1]!))) {
          return json(404, { statusCode: 404, message: 'Inbound webhook not found', error: 'Not Found' });
        }
        return json(200, { roleIds: (fake.requests.at(-1)!.body as { roleIds: string[] }).roleIds });
      }
      const one = url.pathname.match(/^\/api\/admin\/inbound-webhooks\/([^/]+)$/);
      if (one) {
        const id = decodeURIComponent(one[1]!);
        const index = fake.webhooks.findIndex((w) => w.id === id);
        if (index === -1) return json(404, { statusCode: 404, message: 'Inbound webhook not found', error: 'Not Found' });
        if (req.method === 'GET') return json(200, fake.webhooks[index]);
        if (req.method === 'DELETE') {
          fake.webhooks.splice(index, 1);
          return json(204);
        }
        if (req.method === 'PATCH') {
          fake.webhooks[index] = { ...fake.webhooks[index], ...(fake.requests.at(-1)!.body as object) };
          return json(200, fake.webhooks[index]);
        }
      }
      json(404, { statusCode: 404, message: 'Not Found' });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

interface SetupOptions {
  /** Store a session on profile "prod" (the default) unless false. */
  loggedIn?: boolean;
  isInteractive?: boolean;
  /** Answers handed out, in order, to prompts. */
  answers?: string[];
}

async function setup({ loggedIn = true, isInteractive = true, answers = [] }: SetupOptions = {}) {
  const fake = await startFakeMcdi();
  cleanups.push(fake.close);
  const key = randomBytes(32);
  const keys: KeyProvider = { getKey: async () => key };
  const out: string[] = [];
  const info: string[] = [];
  const questions: string[] = [];
  const deps: WebhookDeps = {
    configPath: join(await mkdtemp(join(tmpdir(), 'mcdi-cli-webhook-')), 'config.json'),
    keys,
    out: (line) => out.push(line),
    info: (line) => info.push(line),
    isInteractive,
    ask: async (question) => {
      questions.push(question);
      return answers.shift() ?? '';
    },
  };
  const config = loggedIn
    ? setSession(emptyConfig(), 'prod', fake.baseUrl, {
        accessToken: await encrypt(TOKEN, keys),
        expiresAt: '2026-10-05T12:00:00.000Z',
        adminIdentity: 'kal#member-1',
      })
    : { ...emptyConfig(), profiles: { prod: { baseUrl: fake.baseUrl, session: null } } };
  await saveConfig(config, deps.configPath);
  return { fake, deps, out, info, questions, keys };
}

async function expectCliError(promise: Promise<unknown>, exitCode: ExitCode, message: RegExp) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CliError);
  expect((err as CliError).exitCode).toBe(exitCode);
  expect((err as CliError).message).toMatch(message);
}


describe('loading the admin session', () => {
  it('fails with exit 3 before any request when the profile is not logged in', async () => {
    const { fake, deps } = await setup({ loggedIn: false });
    await expectCliError(webhookList({ profile: 'prod' }, deps), ExitCode.Auth, /not logged in on profile "prod"/);
    expect(fake.requests).toEqual([]);
  });

  it('fails with exit 3 before any request for an unknown profile', async () => {
    const { fake, deps } = await setup();
    await expectCliError(webhookList({ profile: 'staging' }, deps), ExitCode.Auth, /not logged in on profile "staging"/);
    expect(fake.requests).toEqual([]);
  });

  it('maps an MCDI 401 to exit 3 with a re-login hint', async () => {
    const { fake, deps } = await setup();
    fake.fail = { status: 401, body: { statusCode: 401, message: 'Invalid or expired session' } };
    await expectCliError(webhookList({ profile: 'prod' }, deps), ExitCode.Auth, /mcdi-cli login --profile prod/);
  });

  it('maps an unexpected MCDI status to exit 5', async () => {
    const { fake, deps } = await setup();
    fake.fail = { status: 500, body: { statusCode: 500, message: 'Internal server error' } };
    await expectCliError(webhookList({ profile: 'prod' }, deps), ExitCode.Unexpected, /HTTP 500/);
  });
});

describe('webhook list', () => {
  it('lists every webhook without a project filter', async () => {
    const { fake, deps, out } = await setup();
    await webhookList({ profile: 'prod' }, deps);

    expect(fake.requests).toHaveLength(1);
    const [req] = fake.requests;
    expect(req).toMatchObject({ method: 'GET', path: '/api/admin/inbound-webhooks', authorization: `Bearer ${TOKEN}` });
    expect(req!.query.has('projectId')).toBe(false);

    expect(out[0]).toMatch(/^ID\s+NAME\s+SLUG\s+PROJECT\s+STATUS\s+SUBMISSIONS$/);
    expect(out).toHaveLength(3);
    expect(out[1]).toMatch(/^wh-1\s+Recruitment form\s+recruitment\s+proj-1\s+active\s+3$/);
    expect(out[2]).toMatch(/^wh-2\s+Feedback\s+feedback\s+proj-2\s+inactive\s+0$/);
  });

  it('passes --project as ?projectId=', async () => {
    const { fake, deps, out } = await setup();
    await webhookList({ profile: 'prod', project: 'proj-2' }, deps);

    expect(fake.requests[0]!.query.get('projectId')).toBe('proj-2');
    expect(out).toHaveLength(2);
    expect(out[1]).toMatch(/^wh-2\s/);
  });

  it('says so when there are no webhooks', async () => {
    const { deps, out } = await setup();
    await webhookList({ profile: 'prod', project: 'empty' }, deps);
    expect(out).toEqual(['No inbound webhooks in project empty.']);
  });

  it('never prints the session token or secret material', async () => {
    const { deps, out } = await setup();
    await webhookList({ profile: 'prod' }, deps);
    expect(out.join('\n')).not.toContain(TOKEN);
    expect(out.join('\n')).not.toContain(LEAKED_SECRET);
  });
});

describe('webhook get', () => {
  it('prints the webhook with its schema', async () => {
    const { fake, deps, out } = await setup();
    await webhookGet('wh-1', { profile: 'prod' }, deps);

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({ method: 'GET', path: '/api/admin/inbound-webhooks/wh-1' });
    const text = out.join('\n');
    expect(text).toMatch(/^Name:\s+Recruitment form$/m);
    expect(text).toMatch(/^Slug:\s+recruitment$/m);
    expect(text).toMatch(/^Status:\s+active$/m);
    expect(text).toMatch(/^Accepted origins:\s+\(any\)$/m);
    expect(text).toContain('Schema:');
    expect(text).toContain('"key": "email"');
  });

  it('prints only the schema with --schema-only', async () => {
    const { deps, out } = await setup();
    await webhookGet('wh-1', { profile: 'prod', schemaOnly: true }, deps);
    expect(JSON.parse(out.join('\n'))).toEqual(webhookRow().schema);
  });

  it('emits the PRD §11 envelope with --json', async () => {
    const { deps, out } = await setup();
    await webhookGet('wh-1', { profile: 'prod', json: true }, deps);

    const parsed = JSON.parse(out.join('\n'));
    const expected = webhookRow();
    delete expected.signingSecretEnc;
    expect(parsed).toEqual({ ok: true, data: expected, source: 'mcdi' });
  });

  it('combines --schema-only and --json', async () => {
    const { deps, out } = await setup();
    await webhookGet('wh-1', { profile: 'prod', schemaOnly: true, json: true }, deps);
    expect(JSON.parse(out.join('\n'))).toEqual({ ok: true, data: webhookRow().schema, source: 'mcdi' });
  });

  it('URL-encodes the id', async () => {
    const { fake, deps } = await setup();
    await expectCliError(webhookGet('a/b?c', { profile: 'prod' }, deps), ExitCode.NotFound, /not found/);
    expect(fake.requests[0]!.path).toBe('/api/admin/inbound-webhooks/a%2Fb%3Fc');
  });

  it('maps a 404 to exit 4', async () => {
    const { deps } = await setup();
    await expectCliError(webhookGet('missing', { profile: 'prod' }, deps), ExitCode.NotFound, /Inbound webhook not found/);
  });

  it('never prints the session token or secret material, in any output mode', async () => {
    for (const options of [{}, { json: true }, { schemaOnly: true }, { schemaOnly: true, json: true }]) {
      const { deps, out } = await setup();
      await webhookGet('wh-1', { profile: 'prod', ...options }, deps);
      expect(out.join('\n')).not.toContain(TOKEN);
      expect(out.join('\n')).not.toContain(LEAKED_SECRET);
      expect(out.join('\n')).not.toContain('signingSecret');
    }
  });
});

describe('webhook update', () => {
  it('PATCHes only the new name', async () => {
    const { fake, deps, out } = await setup();
    await webhookUpdate('wh-1', { profile: 'prod', name: 'Recruitment 2027' }, deps);

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      method: 'PATCH',
      path: '/api/admin/inbound-webhooks/wh-1',
      authorization: `Bearer ${TOKEN}`,
      body: { name: 'Recruitment 2027' },
    });
    expect(out).toEqual(['Updated Recruitment 2027 (wh-1) on prod; now active']);
  });

  it('maps --inactive to isActive: false', async () => {
    const { fake, deps, out } = await setup();
    await webhookUpdate('wh-1', { profile: 'prod', inactive: true }, deps);
    expect(fake.requests[0]!.body).toEqual({ isActive: false });
    expect(out[0]).toMatch(/now inactive$/);
  });

  it('maps --active to isActive: true, alongside --name', async () => {
    const { fake, deps, out } = await setup();
    await webhookUpdate('wh-2', { profile: 'prod', active: true, name: 'Feedback v2' }, deps);
    expect(fake.requests[0]!.body).toEqual({ name: 'Feedback v2', isActive: true });
    expect(out[0]).toBe('Updated Feedback v2 (wh-2) on prod; now active');
  });

  it('rejects --active with --inactive before any network call', async () => {
    const { fake, deps } = await setup();
    await expectCliError(
      webhookUpdate('wh-1', { profile: 'prod', active: true, inactive: true }, deps),
      ExitCode.PrecheckFailed,
      /--active and --inactive cannot be used together/,
    );
    expect(fake.requests).toEqual([]);
  });

  it('rejects an update with nothing to change before any network call', async () => {
    const { fake, deps } = await setup();
    await expectCliError(webhookUpdate('wh-1', { profile: 'prod' }, deps), ExitCode.PrecheckFailed, /nothing to update/);
    expect(fake.requests).toEqual([]);
  });

  it('sends a schema that passes the local pre-check', async () => {
    const { fake, deps } = await setup();
    const schema = { version: 1, steps: [{ key: 'default', fields: [{ key: 'email', type: 'email', required: true }] }] };
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-schema-')), 'schema.json');
    await writeFile(path, JSON.stringify(schema));

    await webhookUpdate('wh-1', { profile: 'prod', schema: path, inactive: true }, deps);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({ method: 'PATCH', body: { schema, isActive: false } });
  });

  it('does not send the PATCH when the schema fails the local pre-check', async () => {
    const { fake, deps } = await setup();
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-schema-')), 'schema.json');
    await writeFile(path, JSON.stringify({ version: 1, steps: [{ key: 'default', fields: [{ key: 'x', type: 'colour' }] }] }));

    await expectCliError(
      webhookUpdate('wh-1', { profile: 'prod', schema: path, name: 'Renamed' }, deps),
      ExitCode.PrecheckFailed,
      /validation errors? \(source: local\); nothing was sent\n  steps\[0\]\.fields\[0\]/,
    );
    expect(fake.requests).toEqual([]);
  });

  it('does not send the PATCH when the schema file is unreadable or not JSON', async () => {
    const { fake, deps } = await setup();
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-schema-')), 'schema.json');
    await writeFile(path, '{ nope');
    await expectCliError(webhookUpdate('wh-1', { profile: 'prod', schema: path }, deps), ExitCode.PrecheckFailed, /INVALID_JSON/);
    await expectCliError(
      webhookUpdate('wh-1', { profile: 'prod', schema: '/nonexistent/schema.json' }, deps),
      ExitCode.Unexpected,
      /could not read schema/,
    );
    expect(fake.requests).toEqual([]);
  });

  it('checks --active/--inactive before reading the schema file', async () => {
    const { fake, deps } = await setup();
    await expectCliError(
      webhookUpdate('wh-1', { profile: 'prod', schema: '/nonexistent/schema.json', active: true, inactive: true }, deps),
      ExitCode.PrecheckFailed,
      /--active and --inactive/,
    );
    expect(fake.requests).toEqual([]);
  });

  it("surfaces MCDI's 400 as exit 2", async () => {
    const { fake, deps } = await setup();
    fake.fail = {
      status: 400,
      body: { statusCode: 400, message: ['name must be shorter than or equal to 255 characters'], error: 'Bad Request' },
    };
    await expectCliError(
      webhookUpdate('wh-1', { profile: 'prod', name: 'x'.repeat(300) }, deps),
      ExitCode.Rejected,
      /HTTP 400.*name must be shorter/,
    );
  });

  it('maps a 404 to exit 4', async () => {
    const { deps } = await setup();
    await expectCliError(webhookUpdate('missing', { profile: 'prod', inactive: true }, deps), ExitCode.NotFound, /not found/);
  });

  it('never prints the session token or secret material', async () => {
    const { deps, out } = await setup();
    await webhookUpdate('wh-1', { profile: 'prod', name: 'Renamed' }, deps);
    expect(out.join('\n')).not.toContain(TOKEN);
    expect(out.join('\n')).not.toContain(LEAKED_SECRET);
  });
});

describe('webhook roles set', () => {
  const ROLE_A = '123456789012345678';
  const ROLE_B = '234567890123456789';

  it('PUTs the full replacement set, trimmed', async () => {
    const { fake, deps, out } = await setup();
    await webhookRolesSet('wh-1', { profile: 'prod', roles: ` ${ROLE_A} , ${ROLE_B} ` }, deps);

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      path: '/api/admin/inbound-webhooks/wh-1/roles',
      authorization: `Bearer ${TOKEN}`,
      body: { roleIds: [ROLE_A, ROLE_B] },
    });
    expect(out).toEqual([`Allowed reader roles for wh-1 on prod: ${ROLE_A}, ${ROLE_B}`]);
  });

  it('rejects an empty --roles before any network call', async () => {
    for (const roles of ['', '   ', ',', ' , , ']) {
      const { fake, deps } = await setup();
      await expectCliError(
        webhookRolesSet('wh-1', { profile: 'prod', roles }, deps),
        ExitCode.PrecheckFailed,
        /at least one Discord role id/,
      );
      expect(fake.requests).toEqual([]);
    }
  });

  it("surfaces MCDI's 400 for unknown roles as exit 2", async () => {
    const { fake, deps } = await setup();
    fake.fail = { status: 400, body: { statusCode: 400, message: `Unknown role IDs: ${ROLE_B}`, error: 'Bad Request' } };
    await expectCliError(
      webhookRolesSet('wh-1', { profile: 'prod', roles: ROLE_B }, deps),
      ExitCode.Rejected,
      new RegExp(`HTTP 400.*Unknown role IDs: ${ROLE_B}`),
    );
  });

  it("surfaces MCDI's 400 for foreign roles and malformed ids as exit 2", async () => {
    const { fake, deps } = await setup();
    fake.fail = {
      status: 400,
      body: { statusCode: 400, message: `These roles belong to servers this project cannot access: Mod (${ROLE_A})`, error: 'Bad Request' },
    };
    await expectCliError(
      webhookRolesSet('wh-1', { profile: 'prod', roles: ROLE_A }, deps),
      ExitCode.Rejected,
      /servers this project cannot access/,
    );

    fake.fail = { status: 400, body: { statusCode: 400, message: ['each role must be a Discord snowflake'], error: 'Bad Request' } };
    await expectCliError(
      webhookRolesSet('wh-1', { profile: 'prod', roles: 'not-a-role' }, deps),
      ExitCode.Rejected,
      /each role must be a Discord snowflake/,
    );
  });

  it('maps a 404 to exit 4', async () => {
    const { deps } = await setup();
    await expectCliError(webhookRolesSet('missing', { profile: 'prod', roles: ROLE_A }, deps), ExitCode.NotFound, /not found/);
  });

  it('never prints the session token', async () => {
    const { deps, out } = await setup();
    await webhookRolesSet('wh-1', { profile: 'prod', roles: ROLE_A }, deps);
    expect(out.join('\n')).not.toContain(TOKEN);
  });
});

describe('webhook secret get', () => {
  const SECRET_A = 'whsec_recruitment_aaaaaaaaaaaaaaaa1111';
  const SECRET_B = 'whsec_feedback_bbbbbbbbbbbbbbbbbbbb2222';

  /** Stores encrypted secrets on profile "prod", the way `webhook create` / `rotate-secret` will. */
  async function storeSecrets(deps: WebhookDeps, keys: KeyProvider, entries: Array<[string, string, string, string]>) {
    const config = await loadConfig(deps.configPath);
    const webhookSecrets: Record<string, { secret: string; name: string; slug: string }> = {};
    for (const [id, name, slug, secret] of entries) webhookSecrets[id] = { secret: await encrypt(secret, keys), name, slug };
    config.profiles.prod = { ...config.profiles.prod!, webhookSecrets };
    await saveConfig(config, deps.configPath);
  }

  it('fails with rotate-secret guidance when nothing is stored, without any network call', async () => {
    const { fake, deps } = await setup();
    await expectCliError(
      webhookSecretGet({ profile: 'prod' }, deps),
      ExitCode.NotFound,
      /no signing secret is stored locally for profile "prod".*mcdi-cli webhook rotate-secret <id> --profile prod/,
    );
    expect(fake.requests).toEqual([]);
  });

  it('fails the same way for a profile that does not exist', async () => {
    const { deps } = await setup();
    await expectCliError(webhookSecretGet({ profile: 'staging' }, deps), ExitCode.NotFound, /profile "staging"/);
  });

  it('uses the only stored secret without prompting, masked by default', async () => {
    const { fake, deps, out, info, questions, keys } = await setup();
    await storeSecrets(deps, keys, [['wh-1', 'Recruitment form', 'recruitment', SECRET_A]]);
    await webhookSecretGet({ profile: 'prod' }, deps);

    expect(questions).toEqual([]);
    expect(out).toEqual(['Signing secret for Recruitment form (recruitment): ********1111']);
    expect(info).toEqual(['Pass --reveal to print it in plain text.']);
    expect([...out, ...info].join('\n')).not.toContain(SECRET_A);
    expect(fake.requests).toEqual([]);
  });

  it('prints only the plain secret on stdout with --reveal', async () => {
    const { deps, out, info, keys } = await setup();
    await storeSecrets(deps, keys, [['wh-1', 'Recruitment form', 'recruitment', SECRET_A]]);
    await webhookSecretGet({ profile: 'prod', reveal: true }, deps);

    expect(out).toEqual([SECRET_A]);
    expect(info.join('\n')).not.toContain(SECRET_A);
  });

  it('reads the active profile when --profile is omitted', async () => {
    const { deps, out, keys } = await setup();
    await storeSecrets(deps, keys, [['wh-1', 'Recruitment form', 'recruitment', SECRET_A]]);
    await webhookSecretGet({}, deps);
    expect(out[0]).toMatch(/^Signing secret for Recruitment form/);
  });

  it('lists several secrets by name/slug, not id, and uses the one picked', async () => {
    const { deps, out, info, questions, keys } = await setup({ answers: ['2'] });
    await storeSecrets(deps, keys, [
      ['wh-1', 'Recruitment form', 'recruitment', SECRET_A],
      ['wh-2', 'Feedback', 'feedback', SECRET_B],
    ]);
    await webhookSecretGet({ profile: 'prod', reveal: true }, deps);

    expect(info.slice(0, 3)).toEqual([
      'Signing secrets stored for profile "prod":',
      '  1) Recruitment form (recruitment)',
      '  2) Feedback (feedback)',
    ]);
    expect(info.join('\n')).not.toMatch(/wh-1|wh-2/);
    expect(questions).toEqual(['Pick one [1-2]: ']);
    expect(out).toEqual([SECRET_B]);
  });

  it('rejects an answer that is not one of the choices', async () => {
    for (const answer of ['', '0', '3', 'x', '1.5']) {
      const { deps, out, keys } = await setup({ answers: [answer] });
      await storeSecrets(deps, keys, [
        ['wh-1', 'Recruitment form', 'recruitment', SECRET_A],
        ['wh-2', 'Feedback', 'feedback', SECRET_B],
      ]);
      await expectCliError(webhookSecretGet({ profile: 'prod' }, deps), ExitCode.PrecheckFailed, /is not one of 1-2/);
      expect(out).toEqual([]);
    }
  });

  it('never blocks on a prompt without an interactive terminal', async () => {
    const { deps, questions, keys } = await setup({ isInteractive: false });
    await storeSecrets(deps, keys, [
      ['wh-1', 'Recruitment form', 'recruitment', SECRET_A],
      ['wh-2', 'Feedback', 'feedback', SECRET_B],
    ]);
    await expectCliError(webhookSecretGet({ profile: 'prod' }, deps), ExitCode.PrecheckFailed, /no interactive terminal/);
    expect(questions).toEqual([]);
  });

  it('reports an undecryptable secret without echoing it', async () => {
    const { deps, keys } = await setup();
    await storeSecrets(deps, keys, [['wh-1', 'Recruitment form', 'recruitment', SECRET_A]]);
    const otherKey = randomBytes(32);
    const err = await webhookSecretGet({ profile: 'prod' }, { ...deps, keys: { getKey: async () => otherKey } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).exitCode).toBe(ExitCode.Unexpected);
    expect((err as CliError).message).toMatch(/could not decrypt/);
    expect((err as CliError).message).not.toContain(SECRET_A);
  });

  it('keeps secrets encrypted on disk', async () => {
    const { deps, keys } = await setup();
    await storeSecrets(deps, keys, [['wh-1', 'Recruitment form', 'recruitment', SECRET_A]]);
    expect(await readFile(deps.configPath, 'utf8')).not.toContain(SECRET_A);
  });
});

describe('webhook create', () => {
  const ROLE_A = '123456789012345678';
  const SCHEMA = { version: 1, steps: [{ key: 'default', fields: [{ key: 'email', type: 'email', required: true }] }] };

  async function schemaFile(contents: string = JSON.stringify(SCHEMA)): Promise<string> {
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-schema-')), 'schema.json');
    await writeFile(path, contents);
    return path;
  }

  const options = (overrides: Partial<Parameters<typeof webhookCreate>[1]> = {}) => ({
    profile: 'prod',
    name: 'Recruitment 2027',
    project: 'proj-1',
    roles: ROLE_A,
    acceptOrigin: [] as string[],
    ...overrides,
  });

  it('POSTs the schema with a slug derived from the name', async () => {
    const { fake, deps } = await setup();
    await webhookCreate(await schemaFile(), options(), deps);

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({ method: 'POST', path: '/api/admin/inbound-webhooks', authorization: `Bearer ${TOKEN}` });
    expect(fake.requests[0]!.body).toEqual({
      projectId: 'proj-1',
      name: 'Recruitment 2027',
      slug: 'recruitment-2027',
      schema: SCHEMA,
      allowedRoleIds: [ROLE_A],
    });
  });

  it('sends --slug and --accept-origin as given', async () => {
    const { fake, deps } = await setup();
    await webhookCreate(
      await schemaFile(),
      options({ slug: 'join-us', roles: `${ROLE_A}, 234567890123456789`, acceptOrigin: ['https://a.example', 'https://b.example'] }),
      deps,
    );
    expect(fake.requests[0]!.body).toMatchObject({
      slug: 'join-us',
      allowedRoleIds: [ROLE_A, '234567890123456789'],
      acceptedOrigins: ['https://a.example', 'https://b.example'],
    });
  });

  it('stores the signing secret encrypted under the webhook id, retrievable with secret get', async () => {
    const { deps, keys, out } = await setup();
    await webhookCreate(await schemaFile(), options(), deps);

    expect(await readFile(deps.configPath, 'utf8')).not.toContain(CREATED_SECRET);
    const entry = (await loadConfig(deps.configPath)).profiles.prod!.webhookSecrets!['wh-new']!;
    expect(entry).toMatchObject({ name: 'Recruitment 2027', slug: 'recruitment-2027' });
    expect(await decrypt(entry.secret, keys)).toBe(CREATED_SECRET);

    out.length = 0;
    await webhookSecretGet({ profile: 'prod', reveal: true }, deps);
    expect(out).toEqual([CREATED_SECRET]);
  });

  it('keeps the profile session and other stored secrets', async () => {
    const { deps, keys } = await setup();
    const before = await loadConfig(deps.configPath);
    before.profiles.prod!.webhookSecrets = { 'wh-old': { secret: await encrypt('old', keys), name: 'Old', slug: 'old' } };
    await saveConfig(before, deps.configPath);

    await webhookCreate(await schemaFile(), options(), deps);
    const after = (await loadConfig(deps.configPath)).profiles.prod!;
    expect(after.session).toEqual(before.profiles.prod!.session);
    expect(Object.keys(after.webhookSecrets!).sort()).toEqual(['wh-new', 'wh-old']);
  });

  it('prints the secret masked by default and in plain text with --reveal', async () => {
    const masked = await setup();
    await webhookCreate(await schemaFile(), options(), masked.deps);
    expect(masked.out).toContain('Signing secret: ********9999');
    expect(masked.out).toContain('ID:             wh-new');
    expect([...masked.out, ...masked.info].join('\n')).not.toContain(CREATED_SECRET);

    const revealed = await setup();
    await webhookCreate(await schemaFile(), options({ reveal: true }), revealed.deps);
    expect(revealed.out).toContain(`Signing secret: ${CREATED_SECRET}`);
    expect(revealed.info.join('\n')).not.toContain(CREATED_SECRET);
  });

  it('never prints the session token or secret material MCDI did not mean to return', async () => {
    const { deps, out, info } = await setup();
    await webhookCreate(await schemaFile(), options({ reveal: true }), deps);
    expect([...out, ...info].join('\n')).not.toContain(TOKEN);
    expect([...out, ...info].join('\n')).not.toContain(LEAKED_SECRET);
  });

  it('rejects bad arguments and files before any network call', async () => {
    const cases: Array<[() => Promise<string>, ReturnType<typeof options>, ExitCode, RegExp]> = [
      [() => schemaFile(), options({ roles: ' , ' }), ExitCode.PrecheckFailed, /at least one Discord role id/],
      [() => schemaFile(), options({ name: '!!' }), ExitCode.PrecheckFailed, /could not derive a valid slug.*--slug/],
      [() => schemaFile(), options({ slug: 'Bad Slug' }), ExitCode.PrecheckFailed, /--slug "Bad Slug" must be/],
      [() => schemaFile('{ nope'), options(), ExitCode.PrecheckFailed, /1 validation error \(source: local\); nothing was sent\n.*INVALID_JSON/],
      [() => schemaFile('[1, 2]'), options(), ExitCode.PrecheckFailed, /validation error.*source: local/],
      [async () => '/nonexistent/schema.json', options(), ExitCode.Unexpected, /could not read schema/],
    ];
    for (const [path, opts, code, message] of cases) {
      const { fake, deps } = await setup();
      await expectCliError(webhookCreate(await path(), opts, deps), code, message);
      expect(fake.requests).toEqual([]);
    }
  });

  it('runs the local pre-check and sends nothing when the schema fails it', async () => {
    const { fake, deps } = await setup();
    const bad = { version: 1, steps: [{ key: 'default', fields: [{ key: 'colour', type: 'colour' }] }] };
    const err = (await webhookCreate(await schemaFile(JSON.stringify(bad)), options(), deps).catch((e: unknown) => e)) as CliError;

    expect(err).toBeInstanceOf(CliError);
    expect(err.exitCode).toBe(ExitCode.PrecheckFailed);
    expect(err.message).toMatch(/^✗ \d+ validation errors? \(source: local\); nothing was sent\n  steps\[0\]\.fields\[0\]/);
    expect(fake.requests).toEqual([]);
    expect((await loadConfig(deps.configPath)).profiles.prod!.webhookSecrets).toBeUndefined();
  });

  it("surfaces MCDI's schema 400 one error per line with source: mcdi", async () => {
    const { fake, deps } = await setup();
    fake.fail = {
      status: 400,
      body: {
        statusCode: 400,
        error: 'InvalidSchema',
        errors: [
          { path: 'steps[0].fields[0].type', code: 'UNKNOWN_FIELD_TYPE', message: 'Unknown field type "colour"' },
          { path: 'steps[0].fields[1]', code: 'MISSING_MAX_ITEMS', message: 'array fields need maxItems' },
        ],
      },
    };
    const err = (await webhookCreate(await schemaFile(), options(), deps).catch((e: unknown) => e)) as CliError;
    expect(err.exitCode).toBe(ExitCode.Rejected);
    expect(err.message).toBe(
      'MCDI rejected the request (HTTP 400, source: mcdi)\n' +
        '  steps[0].fields[0].type  UNKNOWN_FIELD_TYPE  Unknown field type "colour"\n' +
        '  steps[0].fields[1]  MISSING_MAX_ITEMS  array fields need maxItems',
    );
    expect((await loadConfig(deps.configPath)).profiles.prod!.webhookSecrets).toBeUndefined();
  });

  it("surfaces MCDI's 409 slug conflict as exit 2 and stores nothing", async () => {
    const { deps } = await setup();
    await expectCliError(
      webhookCreate(await schemaFile(), options({ slug: 'recruitment' }), deps),
      ExitCode.Rejected,
      /HTTP 409, source: mcdi\): Project already has a webhook with slug "recruitment"/,
    );
    expect((await loadConfig(deps.configPath)).profiles.prod!.webhookSecrets).toBeUndefined();
  });

  it('says how to recover when the secret cannot be stored locally, without printing it', async () => {
    const { deps, keys, out } = await setup();
    let calls = 0;
    // First key use decrypts the session token; the second (encrypting the new secret) fails.
    const flaky: KeyProvider = {
      getKey: async () => {
        calls += 1;
        if (calls > 1) throw new Error('keychain locked');
        return keys.getKey();
      },
    };
    const err = (await webhookCreate(await schemaFile(), options(), { ...deps, keys: flaky }).catch((e: unknown) => e)) as CliError;
    expect(err.exitCode).toBe(ExitCode.Unexpected);
    expect(err.message).toMatch(/was created on MCDI, but its signing secret could not be stored locally \(keychain locked\)/);
    expect(err.message).toMatch(/mcdi-cli webhook rotate-secret wh-new --profile prod/);
    expect(err.message).not.toContain(CREATED_SECRET);
    expect(out.join('\n')).not.toContain(CREATED_SECRET);
  });
});

describe('slugFromName', () => {
  it('lowercases, strips accents, and collapses everything else to single dashes', () => {
    expect(slugFromName('Recruitment 2027')).toBe('recruitment-2027');
    expect(slugFromName('  Événement — Été!! ')).toBe('evenement-ete');
    expect(slugFromName('x'.repeat(80))).toHaveLength(64);
    expect(slugFromName('!!')).toBe('');
  });
});

describe('webhook delete', () => {
  const SECRET = 'whsec_to_be_deleted_dddddddddddddddd4444';

  /** Stores encrypted secrets for wh-1 and wh-2 on profile "prod". */
  async function storeTwoSecrets(deps: WebhookDeps, keys: KeyProvider) {
    const config = await loadConfig(deps.configPath);
    config.profiles.prod!.webhookSecrets = {
      'wh-1': { secret: await encrypt(SECRET, keys), name: 'Recruitment form', slug: 'recruitment' },
      'wh-2': { secret: await encrypt('other', keys), name: 'Feedback', slug: 'feedback' },
    };
    await saveConfig(config, deps.configPath);
  }

  const storedIds = async (deps: WebhookDeps) =>
    Object.keys((await loadConfig(deps.configPath)).profiles.prod!.webhookSecrets ?? {}).sort();

  it('deletes with --yes without prompting, then removes only that local secret', async () => {
    const { fake, deps, out, questions, keys } = await setup({ isInteractive: false });
    await storeTwoSecrets(deps, keys);
    await webhookDelete('wh-1', { profile: 'prod', yes: true }, deps);

    expect(questions).toEqual([]);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({ method: 'DELETE', path: '/api/admin/inbound-webhooks/wh-1', authorization: `Bearer ${TOKEN}` });
    expect(await storedIds(deps)).toEqual(['wh-2']);
    expect(out).toEqual(['Deleted inbound webhook wh-1 on prod; removed its locally stored signing secret']);
  });

  it('deletes after an interactive "y", warning about submissions and no undo', async () => {
    for (const answer of ['y', 'YES', ' yes ']) {
      const { fake, deps, info, questions, keys } = await setup({ answers: [answer] });
      await storeTwoSecrets(deps, keys);
      await webhookDelete('wh-1', { profile: 'prod' }, deps);

      expect(info.join('\n')).toMatch(/AND ALL OF ITS SUBMISSIONS/);
      expect(info.join('\n')).toMatch(/no undo/);
      expect(questions).toEqual(['Delete it? [y/N] ']);
      expect(fake.requests.map((r) => r.method)).toEqual(['DELETE']);
      expect(await storedIds(deps)).toEqual(['wh-2']);
    }
  });

  it('does not call the API or touch the secret when the user declines', async () => {
    for (const answer of ['', 'n', 'no', 'whatever']) {
      const { fake, deps, keys } = await setup({ answers: [answer] });
      await storeTwoSecrets(deps, keys);
      await expectCliError(webhookDelete('wh-1', { profile: 'prod' }, deps), ExitCode.PrecheckFailed, /aborted; nothing was deleted/);
      expect(fake.requests).toEqual([]);
      expect(await storedIds(deps)).toEqual(['wh-1', 'wh-2']);
    }
  });

  it('fails without --yes and without a terminal instead of waiting for input', async () => {
    const { fake, deps, questions, keys } = await setup({ isInteractive: false });
    await storeTwoSecrets(deps, keys);
    await expectCliError(webhookDelete('wh-1', { profile: 'prod' }, deps), ExitCode.PrecheckFailed, /pass --yes/);
    expect(questions).toEqual([]);
    expect(fake.requests).toEqual([]);
    expect(await storedIds(deps)).toEqual(['wh-1', 'wh-2']);
  });

  it('keeps the local secret when MCDI does not delete the webhook', async () => {
    const notFound = await setup();
    await storeTwoSecrets(notFound.deps, notFound.keys);
    await expectCliError(webhookDelete('wh-1-typo', { profile: 'prod', yes: true }, notFound.deps), ExitCode.NotFound, /not found/);
    expect(await storedIds(notFound.deps)).toEqual(['wh-1', 'wh-2']);

    const broken = await setup();
    await storeTwoSecrets(broken.deps, broken.keys);
    broken.fake.fail = { status: 500, body: { statusCode: 500, message: 'Internal server error' } };
    await expectCliError(webhookDelete('wh-1', { profile: 'prod', yes: true }, broken.deps), ExitCode.Unexpected, /HTTP 500/);
    expect(await storedIds(broken.deps)).toEqual(['wh-1', 'wh-2']);

    const loggedOut = await setup();
    loggedOut.fake.fail = { status: 401, body: { statusCode: 401, message: 'Invalid or expired session' } };
    await expectCliError(webhookDelete('wh-1', { profile: 'prod', yes: true }, loggedOut.deps), ExitCode.Auth, /mcdi-cli login/);
  });

  it('works when no secret was stored for that webhook', async () => {
    const { deps, out } = await setup();
    await webhookDelete('wh-1', { profile: 'prod', yes: true }, deps);
    expect(out).toEqual(['Deleted inbound webhook wh-1 on prod']);
  });

  it('never prints the session token or the stored secret', async () => {
    const { deps, out, info, keys } = await setup({ answers: ['y'] });
    await storeTwoSecrets(deps, keys);
    await webhookDelete('wh-1', { profile: 'prod' }, deps);
    const printed = [...out, ...info].join('\n');
    expect(printed).not.toContain(TOKEN);
    expect(printed).not.toContain(SECRET);
  });
});
