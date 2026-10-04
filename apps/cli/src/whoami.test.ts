import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyConfig, saveConfig, setSession, type Config, type StoredSession } from './config.js';
import { encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { FAKE_MCDI_TOKEN as TOKEN, startFakeMcdi, type FakeMcdi } from './fake-mcdi.js';
import { whoami, type WhoamiDeps } from './whoami.js';

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

const freshConfigPath = async () => join(await mkdtemp(join(tmpdir(), 'm-forge-whoami-')), 'config.json');
const fixedKey = (key = randomBytes(32)): KeyProvider => ({ getKey: async () => key });

async function storedSession(baseUrl: string, keys: KeyProvider, token = TOKEN): Promise<StoredSession> {
  return {
    accessToken: await encrypt(token, keys),
    expiresAt: '2026-10-05T12:00:00.000Z',
    adminIdentity: 'kal#member-1',
  };
}

function deps(configPath: string, keys: KeyProvider, out: string[]): WhoamiDeps {
  return { configPath, keys, out: (line) => out.push(line) };
}

async function withFake(): Promise<FakeMcdi> {
  const fake = await startFakeMcdi();
  cleanups.push(fake.close);
  return fake;
}

describe('whoami (integration)', () => {
  it('prints the admin identity and the profile base URL on success', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    const out: string[] = [];
    await whoami({}, deps(configPath, keys, out));

    expect(out).toEqual(['Logged in as Kal (kal) on default', `MCDI: ${fake.baseUrl}`, 'Session expires: 2026-10-05T12:00:00.000Z']);
    expect(out.join('\n')).not.toContain(TOKEN);
  });

  it('--json emits the raw /me response body, unmodified', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    const out: string[] = [];
    await whoami({ json: true }, deps(configPath, keys, out));

    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!)).toEqual(fake.meBody);
    expect(out[0]).not.toContain(TOKEN);
  });

  it('uses --profile over the active profile', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    let config = setSession(emptyConfig(), 'staging', fake.baseUrl, await storedSession(fake.baseUrl, keys));
    config = setSession(config, 'prod', fake.baseUrl, await storedSession(fake.baseUrl, keys));
    config = { ...config, activeProfile: 'staging' };
    await saveConfig(config, configPath);

    const out: string[] = [];
    await whoami({ profile: 'prod' }, deps(configPath, keys, out));
    expect(out[0]).toContain('on prod');
  });

  it('falls back to the active profile when no --profile is given', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    const config = setSession(emptyConfig(), 'staging', fake.baseUrl, await storedSession(fake.baseUrl, keys));
    await saveConfig(config, configPath);

    const out: string[] = [];
    await whoami({}, deps(configPath, keys, out));
    expect(out[0]).toContain('on staging');
  });

  it('falls back to "default" when there is neither --profile nor an active profile', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    const config: Config = {
      version: 1,
      activeProfile: null,
      profiles: { default: { baseUrl: fake.baseUrl, session: await storedSession(fake.baseUrl, keys) } },
    };
    await saveConfig(config, configPath);

    const out: string[] = [];
    await whoami({}, deps(configPath, keys, out));
    expect(out[0]).toContain('on default');
  });

  it('errors with a login hint and exit 3 when there is no config file at all', async () => {
    const configPath = await freshConfigPath(); // never saved
    await expectCliError(
      whoami({}, deps(configPath, fixedKey(), [])),
      ExitCode.Auth,
      /not logged in on profile "default"[\s\S]*m-forge login --profile default/,
    );
  });

  it('errors with a login hint and exit 3 for an unknown profile', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    await expectCliError(
      whoami({ profile: 'ghost' }, deps(configPath, keys, [])),
      ExitCode.Auth,
      /not logged in on profile "ghost"[\s\S]*m-forge login --profile ghost/,
    );
  });

  it('errors with a login hint and exit 3 when the profile has no session', async () => {
    const configPath = await freshConfigPath();
    const config: Config = { version: 1, activeProfile: 'default', profiles: { default: { baseUrl: 'https://a.example.com', session: null } } };
    await saveConfig(config, configPath);

    await expectCliError(
      whoami({}, deps(configPath, fixedKey(), [])),
      ExitCode.Auth,
      /not logged in on profile "default"[\s\S]*m-forge login --profile default/,
    );
  });

  it('errors with a re-login hint and exit 3 when the stored session cannot be decrypted', async () => {
    const fake = await withFake();
    const encryptKey = fixedKey();
    const decryptKey = fixedKey(); // a different key
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, encryptKey)), configPath);

    await expectCliError(
      whoami({}, deps(configPath, decryptKey, [])),
      ExitCode.Auth,
      /could not decrypt the stored session for profile "default"[\s\S]*m-forge login --profile default.*again/,
    );
  });

  it('maps a 401 to the session-expired hint, exits 3, and makes exactly one request (no retry)', async () => {
    const fake = await withFake();
    fake.meStatus = 401;
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'prod', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    await expectCliError(
      whoami({ profile: 'prod' }, deps(configPath, keys, [])),
      ExitCode.Auth,
      /^session expired, run `m-forge login --profile prod`$/,
    );
    expect(fake.meRequestCount).toBe(1);
  });

  it('still maps 401/403 to auth errors when the error body is not JSON (e.g. a proxy page)', async () => {
    const fake = await withFake();
    fake.meErrorsAsHtml = true;
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'prod', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    fake.meStatus = 401;
    await expectCliError(whoami({ profile: 'prod' }, deps(configPath, keys, [])), ExitCode.Auth, /session expired/);
    fake.meStatus = 403;
    await expectCliError(whoami({ profile: 'prod' }, deps(configPath, keys, [])), ExitCode.Auth, /not a system admin/);
  });

  it('maps a 403 to a not-an-admin error and exits 3', async () => {
    const fake = await withFake();
    fake.meStatus = 403;
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    await expectCliError(whoami({}, deps(configPath, keys, [])), ExitCode.Auth, /not a system admin/);
  });

  it('exits 5 when MCDI is unreachable', async () => {
    const fake = await startFakeMcdi();
    await fake.close(); // nothing is listening anymore
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);

    await expectCliError(whoami({}, deps(configPath, keys, [])), ExitCode.Unexpected, /could not reach MCDI/);
  });

  it('never writes to the config file (read-only)', async () => {
    const fake = await withFake();
    const keys = fixedKey();
    const configPath = await freshConfigPath();
    await saveConfig(setSession(emptyConfig(), 'default', fake.baseUrl, await storedSession(fake.baseUrl, keys)), configPath);
    const before = await readFile(configPath);

    await whoami({ json: true }, deps(configPath, keys, []));

    const after = await readFile(configPath);
    expect(after.equals(before)).toBe(true);
  });
});
