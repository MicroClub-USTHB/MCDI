import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyConfig, loadConfig, saveConfig } from './config.js';
import { decrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { consent, FAKE_MCDI_TOKEN as TOKEN, startFakeMcdi, type FakeMcdi } from './fake-mcdi.js';
import { extractState, login, readCallback, startCallbackListener, type LoginDeps } from './login-flow.js';
import { getAdminLoginUrl, getAdminMe } from './mcdi.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function setup(browser: (fake: FakeMcdi, discordUrl: string) => Promise<boolean> = async (fake, url) => {
  void consent(fake, url);
  return true;
}) {
  const fake = await startFakeMcdi();
  cleanups.push(fake.close);
  const key = randomBytes(32);
  const keys: KeyProvider = { getKey: async () => key };
  const info: string[] = [];
  const out: string[] = [];
  const deps: LoginDeps = {
    configPath: join(await mkdtemp(join(tmpdir(), 'mcdi-cli-login-')), 'config.json'),
    keys,
    openBrowser: (url) => browser(fake, url),
    info: (line) => info.push(line),
    out: (line) => out.push(line),
    timeoutMs: 2_000,
  };
  return { fake, deps, keys, info, out };
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

describe('readCallback', () => {
  const params = (p: Record<string, string>) => new URLSearchParams(p);

  it('accepts a token only with the matching state', () => {
    expect(readCallback(params({ token: 't', state: 's' }), 's')).toEqual({ kind: 'token', token: 't' });
    expect(readCallback(params({ token: 't', state: 'other' }), 's').kind).toBe('ignore');
    expect(readCallback(params({ token: 't' }), 's').kind).toBe('ignore');
    expect(readCallback(params({ state: 's' }), 's').kind).toBe('ignore');
  });

  it('reports an MCDI error', () => {
    expect(readCallback(params({ error: 'Not an admin' }), 's')).toEqual({ kind: 'error', message: 'Not an admin' });
  });
});

describe('extractState', () => {
  it('reads the state from the Discord URL', () => {
    expect(extractState('https://discord.com/oauth2/authorize?state=abc&client_id=1')).toBe('abc');
  });

  it('refuses non-https URLs, garbage, and URLs without state', () => {
    expect(() => extractState('javascript:alert(1)')).toThrow('non-https');
    expect(() => extractState('http://discord.com/?state=a')).toThrow('non-https');
    expect(() => extractState('nope')).toThrow('invalid Discord URL');
    expect(() => extractState('https://discord.com/oauth2/authorize')).toThrow('no OAuth state');
  });
});

describe('callback listener', () => {
  it('binds to 127.0.0.1 only and 404s anything but GET /callback', async () => {
    const listener = await startCallbackListener(() => {});
    cleanups.push(listener.close);
    const url = new URL(listener.redirectUri);
    expect(url.hostname).toBe('127.0.0.1');
    expect(Number(url.port)).toBeGreaterThan(0);
    expect((await fetch(new URL('/other', url))).status).toBe(404);
    expect((await fetch(url, { method: 'POST' })).status).toBe(404);
  });
});

describe('mcdi client', () => {
  it('sends the loopback redirect_uri and returns the Discord URL', async () => {
    const fake = await startFakeMcdi();
    cleanups.push(fake.close);
    const url = await getAdminLoginUrl(fake.baseUrl, 'http://127.0.0.1:1234/callback');
    expect(url).toMatch(/^https:\/\/discord\.com\/oauth2\/authorize\?.*state=/);
    expect(fake.lastRedirectUri).toBe('http://127.0.0.1:1234/callback');
  });

  it('maps 401/403 to auth errors', async () => {
    const fake = await startFakeMcdi();
    cleanups.push(fake.close);
    await expectCliError(getAdminMe(fake.baseUrl, 'wrong'), ExitCode.Auth, /invalid or expired/);
    fake.meStatus = 403;
    await expectCliError(getAdminMe(fake.baseUrl, TOKEN), ExitCode.Auth, /not a system admin/);
  });

  it('reports an unreachable MCDI as exit 5', async () => {
    const fake = await startFakeMcdi();
    await fake.close();
    await expectCliError(getAdminLoginUrl(fake.baseUrl, 'http://127.0.0.1:1/callback'), ExitCode.Unexpected, /could not reach MCDI/);
  });
});

describe('login (integration)', () => {
  it('logs in end to end and stores the session encrypted', async () => {
    const { fake, deps, keys, info, out } = await setup();
    await login({ profile: 'prod', baseUrl: `${fake.baseUrl}/` }, deps);

    expect(out).toEqual(['Logged in as Kal on prod']);
    expect(info.join('\n')).toContain('https://discord.com/oauth2/authorize');
    expect(fake.lastRedirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);

    const raw = await readFile(deps.configPath, 'utf8');
    expect(raw).not.toContain(TOKEN);
    expect((await stat(deps.configPath)).mode & 0o777).toBe(0o600);

    const config = await loadConfig(deps.configPath);
    expect(config.activeProfile).toBe('prod');
    const profile = config.profiles.prod!;
    expect(profile.baseUrl).toBe(fake.baseUrl);
    expect(profile.session!.expiresAt).toBe('2026-10-05T12:00:00.000Z');
    expect(profile.session!.adminIdentity).toBe('kal#member-1');
    expect(await decrypt(profile.session!.accessToken, keys)).toBe(TOKEN);
  });

  it('closes the loopback listener afterwards', async () => {
    const { fake, deps } = await setup();
    await login({ baseUrl: fake.baseUrl }, deps);
    await expect(fetch(fake.lastRedirectUri!)).rejects.toThrow();
  });

  it('prints the URL when the browser cannot be opened, and still completes', async () => {
    const { deps, info, out, fake } = await setup(async (f, url) => {
      void consent(f, url);
      return false;
    });
    await login({ baseUrl: fake.baseUrl }, deps);
    expect(info.join('\n')).toMatch(/Couldn't open a browser automatically[\s\S]*https:\/\/discord\.com/);
    expect(out).toEqual(['Logged in as Kal on default']);
  });

  it('ignores a callback with the wrong state and keeps waiting for the real one', async () => {
    const { deps, info, out, fake } = await setup(async (f, url) => {
      const forged = await consent(f, url, { state: 'forged', token: 'attacker-token' });
      expect(forged.status).toBe(400);
      void consent(f, url);
      return true;
    });
    await login({ baseUrl: fake.baseUrl }, deps);
    expect(info.join('\n')).toContain('ignored a callback request: state does not match');
    expect(out).toEqual(['Logged in as Kal on default']);
  });

  it('fails with exit 3 when MCDI reports an error on the callback', async () => {
    const { deps, fake } = await setup(async (f, url) => {
      void consent(f, url, { error: 'You do not have the admin role' });
      return true;
    });
    await expectCliError(login({ baseUrl: fake.baseUrl }, deps), ExitCode.Auth, /You do not have the admin role/);
    expect(await loadConfig(deps.configPath)).toEqual(emptyConfig());
  });

  it('fails with exit 3 when the account is not an admin, and saves nothing', async () => {
    const { deps, fake } = await setup();
    fake.meStatus = 403;
    await expectCliError(login({ baseUrl: fake.baseUrl }, deps), ExitCode.Auth, /not a system admin/);
    expect(await loadConfig(deps.configPath)).toEqual(emptyConfig());
  });

  it('times out with exit 3 and a hint about issue #2 when no callback arrives', async () => {
    const { deps, fake } = await setup(async () => true);
    deps.timeoutMs = 200;
    await expectCliError(login({ baseUrl: fake.baseUrl }, deps), ExitCode.Auth, /timed out[\s\S]*issue #2/);
  });

  it('fails with exit 5 when MCDI will not start the login', async () => {
    const { deps, fake } = await setup();
    fake.loginStatus = 500;
    await expectCliError(login({ baseUrl: fake.baseUrl }, deps), ExitCode.Unexpected, /HTTP 500/);
  });

  it('requires --base-url for a new profile', async () => {
    const { deps } = await setup();
    await expectCliError(login({ profile: 'fresh' }, deps), ExitCode.Unexpected, /--base-url/);
  });

  it('reuses a saved base URL and leaves other profiles and the active profile alone', async () => {
    const { deps, fake } = await setup();
    await saveConfig(
      {
        version: 1,
        activeProfile: 'local',
        profiles: {
          local: { baseUrl: 'http://localhost:3000', session: null },
          staging: { baseUrl: fake.baseUrl, session: null },
        },
      },
      deps.configPath,
    );
    await login({ profile: 'staging' }, deps);

    const config = await loadConfig(deps.configPath);
    expect(config.activeProfile).toBe('local');
    expect(config.profiles.local).toEqual({ baseUrl: 'http://localhost:3000', session: null });
    expect(config.profiles.staging!.session).not.toBeNull();
  });
});
