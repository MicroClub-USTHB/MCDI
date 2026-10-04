import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyConfig, saveConfig, setSession } from './config.js';
import { encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { webhookList, type WebhookDeps } from './webhook-flow.js';

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
  expiresAt?: string;
}

async function setup({ loggedIn = true, expiresAt = '2026-10-05T12:00:00.000Z' }: SetupOptions = {}) {
  const fake = await startFakeMcdi();
  cleanups.push(fake.close);
  const key = randomBytes(32);
  const keys: KeyProvider = { getKey: async () => key };
  const out: string[] = [];
  const info: string[] = [];
  const deps: WebhookDeps = {
    configPath: join(await mkdtemp(join(tmpdir(), 'mcdi-cli-webhook-')), 'config.json'),
    keys,
    out: (line) => out.push(line),
    info: (line) => info.push(line),
    now: () => new Date('2026-10-04T12:00:00.000Z'),
  };
  const config = loggedIn
    ? setSession(emptyConfig(), 'prod', fake.baseUrl, {
        accessToken: await encrypt(TOKEN, keys),
        expiresAt,
        adminIdentity: 'kal#member-1',
      })
    : { ...emptyConfig(), profiles: { prod: { baseUrl: fake.baseUrl, session: null } } };
  await saveConfig(config, deps.configPath);
  return { fake, deps, out, info };
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

/** Everything the command printed, on either stream. */
function printed(out: string[], info: string[]): string {
  return [...out, ...info].join('\n');
}

describe('loading the admin session', () => {
  it('fails with exit 3 before any request when the profile is not logged in', async () => {
    const { fake, deps } = await setup({ loggedIn: false });
    await expectCliError(webhookList({ profile: 'prod' }, deps), ExitCode.Auth, /not logged in on profile "prod"/);
    expect(fake.requests).toEqual([]);
  });

  it('fails with exit 3 before any request when the session has expired', async () => {
    const { fake, deps } = await setup({ expiresAt: '2026-10-04T11:59:59.000Z' });
    await expectCliError(webhookList({ profile: 'prod' }, deps), ExitCode.Auth, /session expired.*mcdi-cli login --profile prod/);
    expect(fake.requests).toEqual([]);
  });

  it('fails with exit 3 for an unknown profile', async () => {
    const { deps } = await setup();
    await expectCliError(webhookList({ profile: 'staging' }, deps), ExitCode.Auth, /profile "staging" does not exist/);
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
    const { deps, out, info } = await setup();
    await webhookList({ profile: 'prod' }, deps);
    expect(printed(out, info)).not.toContain(TOKEN);
    expect(printed(out, info)).not.toContain(LEAKED_SECRET);
  });
});
