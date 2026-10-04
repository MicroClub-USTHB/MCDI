import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyConfig, loadConfig, saveConfig, setSession } from './config.js';
import { encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import {
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
/** Never returned by the real API; the fake slips it in to prove m-forge drops unknown fields. */
const LEAKED_SECRET = 'whsec_must_never_be_printed';

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
    configPath: join(await mkdtemp(join(tmpdir(), 'm-forge-webhook-')), 'config.json'),
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
    await expectCliError(webhookList({ profile: 'prod' }, deps), ExitCode.Auth, /m-forge login --profile prod/);
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

  it('refuses --schema without sending the PATCH while the issue #5 pre-check is missing', async () => {
    const { fake, deps } = await setup();
    await expectCliError(
      webhookUpdate('wh-1', { profile: 'prod', schema: 'schema.json', name: 'x' }, deps),
      ExitCode.Unexpected,
      /issue #5.*nothing was sent/,
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
      /no signing secret is stored locally for profile "prod".*m-forge webhook rotate-secret <id> --profile prod/,
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
