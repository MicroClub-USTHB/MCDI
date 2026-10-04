/**
 * Test-only support: a stand-in for MCDI's admin auth endpoints, with response
 * shapes copied from MicroClub-USTHB/MCDI apps/api/src/modules/auth
 * (auth.controller.ts, admin-auth.service.ts). Used by login-flow.test.ts and
 * whoami.test.ts over real HTTP on 127.0.0.1 — never imported by shipped code.
 */
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeMcdi {
  baseUrl: string;
  /** redirect_uri the CLI sent to /auth/admin/discord. */
  lastRedirectUri: string | undefined;
  /** Status /auth/admin/me returns once the bearer token matches FAKE_MCDI_TOKEN. */
  meStatus: number;
  /** Status /auth/admin/discord returns. */
  loginStatus: number;
  /** Body /auth/admin/me returns on success; mutate to test --json / display-name fallbacks. */
  meBody: Record<string, unknown>;
  /** Counts every /auth/admin/me request, so tests can prove there's no retry loop. */
  meRequestCount: number;
  /** Answer /auth/admin/me errors with an HTML body, like a reverse proxy might. */
  meErrorsAsHtml: boolean;
  /** Status /auth/admin/logout returns. */
  logoutStatus: number;
  /** Counts every /auth/admin/logout request, so tests can prove there's exactly one per run. */
  logoutRequestCount: number;
  close(): Promise<void>;
}

export const FAKE_MCDI_TOKEN = 'a'.repeat(64);

export async function startFakeMcdi(): Promise<FakeMcdi> {
  const fake: FakeMcdi = {
    baseUrl: '',
    lastRedirectUri: undefined,
    meStatus: 200,
    loginStatus: 200,
    meRequestCount: 0,
    meErrorsAsHtml: false,
    logoutStatus: 200,
    logoutRequestCount: 0,
    meBody: {
      id: 'member-1',
      username: 'kal',
      globalName: 'Kal',
      displayName: null,
      preferredName: null,
      avatar: null,
      email: null,
      isSystemAdmin: true,
      sessionExpiresAt: '2026-10-05T12:00:00.000Z',
    },
    close: async () => {},
  };
  const revokedTokens = new Set<string>();
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const json = (status: number, body: unknown) =>
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    const bearer = req.headers.authorization === `Bearer ${FAKE_MCDI_TOKEN}` && !revokedTokens.has(FAKE_MCDI_TOKEN);

    if (url.pathname === '/api/auth/admin/discord') {
      fake.lastRedirectUri = url.searchParams.get('redirect_uri') ?? undefined;
      if (fake.loginStatus !== 200) return json(fake.loginStatus, { statusCode: fake.loginStatus, message: 'boom' });
      const state = randomBytes(32).toString('hex');
      return json(200, {
        url: `https://discord.com/oauth2/authorize?client_id=1&redirect_uri=x&response_type=code&scope=identify&state=${state}`,
      });
    }
    if (url.pathname === '/api/auth/admin/me') {
      fake.meRequestCount += 1;
      const status = !bearer ? 401 : fake.meStatus;
      if (status !== 200 && fake.meErrorsAsHtml) {
        return res.writeHead(status, { 'Content-Type': 'text/html' }).end('<html><body>Unauthorized</body></html>');
      }
      if (!bearer) {
        return json(401, { statusCode: 401, message: 'Invalid or expired session', error: 'Unauthorized' });
      }
      if (fake.meStatus !== 200) return json(fake.meStatus, { statusCode: fake.meStatus, message: 'Forbidden' });
      return json(200, fake.meBody);
    }
    if (url.pathname === '/api/auth/admin/logout') {
      fake.logoutRequestCount += 1;
      if (!bearer) {
        return json(401, { statusCode: 401, message: 'Invalid or expired session', error: 'Unauthorized' });
      }
      if (fake.logoutStatus !== 200) {
        return json(fake.logoutStatus, { statusCode: fake.logoutStatus, message: 'logout failed' });
      }
      revokedTokens.add(FAKE_MCDI_TOKEN);
      return json(200, { success: true });
    }
    json(404, { statusCode: 404, message: 'Not Found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

/** What a browser does after Discord consent once #2 lands: follow MCDI's redirect to the loopback URL. */
export function consent(fake: FakeMcdi, discordUrl: string, params: Record<string, string> = {}): Promise<Response> {
  const state = new URL(discordUrl).searchParams.get('state')!;
  const target = new URL(fake.lastRedirectUri!);
  for (const [k, v] of Object.entries({ token: FAKE_MCDI_TOKEN, state, ...params })) target.searchParams.set(k, v);
  return fetch(target);
}
