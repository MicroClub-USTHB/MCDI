import { mkdtemp } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addProfile, emptyConfig, loadConfig, saveConfig, setWebhookSecret } from './config.js';
import { decrypt, sessionContext } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { login, type LoginDeps } from './login-flow.js';
import { fakeMcdi, json } from './test-support/fake-mcdi.js';
import { fixedKeys } from './test-support/keys.js';

const BASE = 'https://mcdi.example.com';
const ME = { id: '42', username: 'kal', sessionExpiresAt: '2026-10-20T00:00:00.000Z' };

afterEach(() => vi.unstubAllGlobals());

const tempConfig = async () =>
  join(await mkdtemp(join(tmpdir(), 'mcdi-cli-login-')), 'config.json');

function deps(configPath: string, keys = fixedKeys()): LoginDeps {
  // The "browser" follows MCDI's redirect: it calls the CLI's loopback listener with a code.
  const openBrowser = async (discordUrl: string) => {
    const url = new URL(discordUrl);
    const redirect = new URL(url.searchParams.get('redirect_uri')!);
    redirect.searchParams.set('code', 'one-time-code');
    redirect.searchParams.set('state', url.searchParams.get('state')!);
    get(redirect, (res) => res.resume()).on('error', () => {});
    return true;
  };
  return { configPath, keys, openBrowser, info: () => {}, out: () => {}, timeoutMs: 5_000 };
}

describe('login (end to end against a fake MCDI)', () => {
  it('exchanges the loopback code with the PKCE verifier and stores the session encrypted', async () => {
    const configPath = await tempConfig();
    const keys = fixedKeys();
    let verifier: string | undefined;
    fakeMcdi({
      'GET /auth/admin/discord': (url) => {
        const discord = new URL('https://discord.com/oauth2/authorize');
        discord.searchParams.set('state', 'st-1');
        discord.searchParams.set('redirect_uri', url.searchParams.get('redirect_uri')!);
        return json({ url: discord.toString() });
      },
      'POST /auth/admin/token': (_url, init) => {
        const body = JSON.parse(String(init.body)) as { code: string; codeVerifier: string };
        expect(body.code).toBe('one-time-code');
        verifier = body.codeVerifier;
        return json({ token: 'session-token', expiresAt: ME.sessionExpiresAt });
      },
      'GET /auth/admin/me': () => json(ME),
    });

    await login({ profile: 'prod', baseUrl: BASE }, deps(configPath, keys));

    expect(verifier).toMatch(/^[\w-]{43,}$/);
    const stored = (await loadConfig(configPath)).profiles.prod!;
    expect(stored.baseUrl).toBe(BASE);
    expect(stored.session!.accessToken).not.toContain('session-token');
    expect(await decrypt(stored.session!.accessToken, keys, sessionContext('prod'))).toBe(
      'session-token',
    );
  });

  it('refuses to repoint a profile that holds signing secrets at another MCDI', async () => {
    const configPath = await tempConfig();
    const config = setWebhookSecret(addProfile(emptyConfig(), 'prod', BASE), 'prod', 'wh-1', {
      secret: 'v1:kc:a:b:c',
      name: 'Signup',
      slug: 'signup',
    });
    await saveConfig(config, configPath);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const err = await login(
      { profile: 'prod', baseUrl: 'https://other.example.com' },
      deps(configPath),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).exitCode).toBe(ExitCode.PrecheckFailed);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
