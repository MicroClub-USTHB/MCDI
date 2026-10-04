import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyConfig, loadConfig, saveConfig, setSession, type Config, type StoredSession } from './config.js';
import { encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { FAKE_MCDI_TOKEN as TOKEN, startFakeMcdi, type FakeMcdi } from './fake-mcdi.js';
import { logout, type LogoutDeps } from './logout.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function expectCliError(promise: Promise<unknown>, exitCode: ExitCode, message: RegExp) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CliError);
  expect((err as CliError).exitCode).toBe(exitCode);
  expect((err as CliError).message).toMatch(message);
}

const freshConfigPath = async () => join(await mkdtemp(join(tmpdir(), 'm-forge-logout-')), 'config.json');
const fixedKey = (key = randomBytes(32)): KeyProvider => ({ getKey: async () => key });

async function storedSession(keys: KeyProvider, token = TOKEN): Promise<StoredSession> {
  return {
    accessToken: await encrypt(token, keys),
    expiresAt: '2026-10-05T12:00:00.000Z',
    adminIdentity: 'kal#member-1',
  };
}

function deps(configPath: string, keys: KeyProvider, out: string[], warn: string[] = []): LogoutDeps {
  return { configPath, keys, out: (line) => out.push(line), warn: (line) => warn.push(line) };
}

async function withFake(): Promise<FakeMcdi> {
  const fake = await startFakeMcdi();
  cleanups.push(fake.close);
  return fake;
}

describe('logout (integration)', () => {
  it('server 200: revokes server-side, clears locally, and prints confirmation', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);

    const out: string[] = [];
    const warn: string[] = [];
    await logout({}, deps(configPath, keys, out, warn));

    expect(out).toEqual(['Logged out of default']);
    expect(warn).toEqual([]);
    expect(fake.logoutRequestCount).toBe(1);

    const config = await loadConfig(configPath);
    expect(config.profiles.default!.session).toBeNull();
    expect(config.profiles.default!.baseUrl).toBe(fake.baseUrl);

    // The token really was revoked server-side: /me now rejects it.
    const meRes = await fetch(`${fake.baseUrl}/api/auth/admin/me`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(meRes.status).toBe(401);
  });

  it('server 401 (already expired): clears locally and adds the expired note, exit 0', async () => {
    const fake = await withFake();
    fake.meStatus = 401; // irrelevant to logout itself, just mirrors a stale session
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);
    fake.logoutStatus = 401;

    const out: string[] = [];
    await logout({}, deps(configPath, keys, out));

    expect(out).toEqual(['Logged out of default', '(the session had already expired on MCDI)']);
    const config = await loadConfig(configPath);
    expect(config.profiles.default!.session).toBeNull();
  });

  it('server 403 (no longer admin): clears locally, warns, still exits 0', async () => {
    const fake = await withFake();
    fake.logoutStatus = 403;
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);

    const out: string[] = [];
    const warn: string[] = [];
    await logout({}, deps(configPath, keys, out, warn));

    expect(out).toEqual(['Logged out of default']);
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatch(/no longer a system admin/);
    const config = await loadConfig(configPath);
    expect(config.profiles.default!.session).toBeNull();
  });

  it('profile exists but session is already null: no network call, nothing written', async () => {
    const fake = await withFake();
    const configPath = await freshConfigPath();
    const config: Config = { version: 1, activeProfile: 'default', profiles: { default: { baseUrl: fake.baseUrl, session: null } } };
    await saveConfig(config, configPath);

    const out: string[] = [];
    await logout({}, deps(configPath, fixedKey(), out));

    expect(out).toEqual(['Not logged in on default, nothing to do']);
    expect(fake.logoutRequestCount).toBe(0);
    expect(await loadConfig(configPath)).toEqual(config);
  });

  it('profile does not exist: CliError(Auth), no network call, nothing written', async () => {
    const fake = await withFake();
    const configPath = await freshConfigPath();
    const config = setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fixedKey()));
    await saveConfig(config, configPath);

    await expectCliError(logout({ profile: 'ghost' }, deps(configPath, fixedKey(), [])), ExitCode.Auth, /no profile named "ghost"/);
    expect(fake.logoutRequestCount).toBe(0);
    expect(await loadConfig(configPath)).toEqual(config);
  });

  it('stored token cannot be decrypted: no network call, clears locally, warns with expiresAt', async () => {
    const fake = await withFake();
    const encryptKey = fixedKey();
    const decryptKey = fixedKey(); // different key
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(encryptKey)), configPath);

    const out: string[] = [];
    const warn: string[] = [];
    await logout({}, deps(configPath, decryptKey, out, warn));

    expect(out).toEqual(['Logged out of default']);
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatch(/could not be decrypted/);
    expect(warn[0]).toContain('2026-10-05T12:00:00.000Z');
    expect(fake.logoutRequestCount).toBe(0);

    const config = await loadConfig(configPath);
    expect(config.profiles.default!.session).toBeNull();
  });

  it('MCDI unreachable: clears locally first, then exits 5 with the expiresAt in the message', async () => {
    const fake = await startFakeMcdi();
    await fake.close(); // nothing listening
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);

    await expectCliError(
      logout({}, deps(configPath, keys, [])),
      ExitCode.Unexpected,
      /logged out of default locally[\s\S]*could not reach MCDI[\s\S]*2026-10-05T12:00:00\.000Z/,
    );

    const config = await loadConfig(configPath);
    expect(config.profiles.default!.session).toBeNull();
  });

  it('MCDI 500: clears locally first, then exits 5 with the expiresAt in the message', async () => {
    const fake = await withFake();
    fake.logoutStatus = 500;
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);

    await expectCliError(
      logout({}, deps(configPath, keys, [])),
      ExitCode.Unexpected,
      /logged out of default locally[\s\S]*HTTP 500[\s\S]*2026-10-05T12:00:00\.000Z/,
    );

    const config = await loadConfig(configPath);
    expect(config.profiles.default!.session).toBeNull();
    expect(fake.logoutRequestCount).toBe(1);
  });

  it('running logout twice is idempotent: second run says nothing to do, exit 0, no extra request', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);

    await logout({}, deps(configPath, keys, []));
    expect(fake.logoutRequestCount).toBe(1);

    const out: string[] = [];
    await logout({}, deps(configPath, keys, out));
    expect(out).toEqual(['Not logged in on default, nothing to do']);
    expect(fake.logoutRequestCount).toBe(1); // no second request
  });

  it('leaves other profiles, baseUrl, and activeProfile untouched', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    let config = setSession(emptyConfig(), 'prod', fake.baseUrl, await storedSession(keys));
    config = setSession(config, 'staging', 'http://localhost:9999', await storedSession(keys));
    config = { ...config, activeProfile: 'staging' };
    await saveConfig(config, configPath);

    await logout({ profile: 'prod' }, deps(configPath, keys, []));

    const after = await loadConfig(configPath);
    expect(after.activeProfile).toBe('staging');
    expect(after.profiles.prod!.baseUrl).toBe(fake.baseUrl);
    expect(after.profiles.prod!.session).toBeNull();
    expect(after.profiles.staging).toEqual(config.profiles.staging);
  });

  it('uses --profile over the active profile', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    let config = setSession(emptyConfig(), 'staging', fake.baseUrl, await storedSession(keys));
    config = setSession(config, 'prod', fake.baseUrl, await storedSession(keys));
    config = { ...config, activeProfile: 'staging' };
    await saveConfig(config, configPath);

    const out: string[] = [];
    await logout({ profile: 'prod' }, deps(configPath, keys, out));
    expect(out).toEqual(['Logged out of prod']);
    const after = await loadConfig(configPath);
    expect(after.profiles.prod!.session).toBeNull();
    expect(after.profiles.staging!.session).not.toBeNull();
  });

  it('never prints the token in stdout or stderr output, across every outcome', async () => {
    const fake = await withFake();
    const keys = fixedKey();

    for (const status of [200, 401, 403, 500]) {
      fake.logoutStatus = status;
      const configPath = await freshConfigPath();
      await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(keys)), configPath);
      const out: string[] = [];
      const warn: string[] = [];
      await logout({}, deps(configPath, keys, out, warn)).catch(() => {});
      expect(out.join('\n')).not.toContain(TOKEN);
      expect(warn.join('\n')).not.toContain(TOKEN);
    }

    // Undecryptable-token path too.
    const otherKey = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(otherKey)), configPath);
    const out: string[] = [];
    const warn: string[] = [];
    await logout({}, deps(configPath, keys, out, warn));
    expect(out.join('\n')).not.toContain(TOKEN);
    expect(warn.join('\n')).not.toContain(TOKEN);
  });
});
