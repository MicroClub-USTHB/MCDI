import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addProfile,
  loadConfig,
  saveConfig,
  setSession,
  setWebhookSecret,
  type Config,
} from './config.js';
import { CliError } from './errors.js';
import { profileAdd, profileList, profileRemove, profileUse, type ProfileDeps } from './profile.js';

const session = {
  accessToken: 'v1:aaa:bbb:ccc',
  expiresAt: '2026-10-05T00:00:00.000Z',
  adminIdentity: 'kal#1',
};
const secretEntry = { secret: 'v1:s:e:c', name: 'Recruitment', slug: 'recruitment' };

async function tempConfigPath(config: Config): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), 'mcid-cli-profile-')), 'config.json');
  await saveConfig(config, path);
  return path;
}

function fakeDeps(configPath: string, overrides: Partial<ProfileDeps> = {}): ProfileDeps {
  return {
    configPath,
    out: () => {},
    info: () => {},
    isInteractive: false,
    ask: async () => '',
    ...overrides,
  };
}

function collect() {
  const lines: string[] = [];
  return { out: (line: string) => lines.push(line), lines };
}

async function captureError(promise: Promise<unknown>): Promise<CliError> {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CliError);
  return err as CliError;
}

describe('profileList', () => {
  it('hints to add a profile or log in when there are none', async () => {
    const path = await tempConfigPath({ version: 1, activeProfile: null, profiles: {} });
    const out = collect();
    await profileList(fakeDeps(path, { out: out.out }));
    expect(out.lines).toEqual([
      'No profiles configured; run `mcid-cli profile add <name> --base-url <url>` or `mcid-cli login`.',
    ]);
  });

  it('shows the active marker, base URL, session state, and secret count for each profile', async () => {
    const now = new Date('2026-10-05T12:00:00.000Z');
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = addProfile(config, 'staging', 'https://b.example.com');
    config = addProfile(config, 'expired', 'https://c.example.com');
    config = setSession(config, 'prod', 'https://a.example.com', {
      ...session,
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    config = setSession(config, 'expired', 'https://c.example.com', {
      ...session,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    // setSession makes the first profile active; force staging active to check the marker lands on the right row.
    config = { ...config, activeProfile: 'staging' };

    const path = await tempConfigPath(config);
    const bytesBefore = await readFile(path);
    const out = collect();
    await profileList(fakeDeps(path, { out: out.out, now: () => now }));

    const text = out.lines.join('\n');
    expect(text).toContain('staging');
    const lines = out.lines;
    const stagingLine = lines.find((l) => l.includes('staging'))!;
    expect(stagingLine.trimStart().startsWith('*')).toBe(true);
    const prodLine = lines.find((l) => l.includes('prod') && !l.includes('staging'))!;
    expect(prodLine).toContain('logged in as kal#1 until 2027-01-01T00:00:00.000Z');
    expect(prodLine).toContain('1');
    const expiredLine = lines.find(
      (l) => l.includes('expired') && l.includes('https://c.example.com'),
    )!;
    expect(expiredLine).toContain('expired');
    expect(prodLine.trimStart().startsWith('*')).toBe(false);

    expect(await readFile(path)).toEqual(bytesBefore);
  });
});

describe('profileAdd', () => {
  it('normalizes the base URL, adds the profile, and becomes active only when none is active yet', async () => {
    const path = await tempConfigPath({ version: 1, activeProfile: null, profiles: {} });
    const out = collect();
    await profileAdd(
      'prod',
      { baseUrl: 'https://mcid.example.com/' },
      fakeDeps(path, { out: out.out }),
    );
    expect(out.lines[0]).toBe(
      'Added profile "prod" (https://mcid.example.com); it is now the active profile',
    );

    const config = await loadConfig(path);
    expect(config.profiles.prod).toEqual({ baseUrl: 'https://mcid.example.com', session: null });
    expect(config.activeProfile).toBe('prod');

    const out2 = collect();
    await profileAdd(
      'staging',
      { baseUrl: 'http://localhost:3000/' },
      fakeDeps(path, { out: out2.out }),
    );
    expect(out2.lines[0]).toBe('Added profile "staging" (http://localhost:3000)');
    const config2 = await loadConfig(path);
    expect(config2.activeProfile).toBe('prod');
    expect(config2.profiles.staging).toEqual({ baseUrl: 'http://localhost:3000', session: null });
  });

  it('rejects a bad name and never writes the config', async () => {
    const path = await tempConfigPath({ version: 1, activeProfile: null, profiles: {} });
    const err = await captureError(
      profileAdd('bad name', { baseUrl: 'https://a.example.com' }, fakeDeps(path)),
    );
    expect(err.exitCode).toBe(1);
    expect(await loadConfig(path)).toEqual({ version: 1, activeProfile: null, profiles: {} });
  });

  it('refuses to overwrite an existing profile', async () => {
    const config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    const path = await tempConfigPath(config);
    const err = await captureError(
      profileAdd('prod', { baseUrl: 'https://different.example.com' }, fakeDeps(path)),
    );
    expect(err.exitCode).toBe(1);
    expect(err.message).toContain('already exists');
    const after = await loadConfig(path);
    expect(after.profiles.prod).toEqual({ baseUrl: 'https://a.example.com', session: null });
  });
});

describe('profileUse', () => {
  it('sets the active profile', async () => {
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = addProfile(config, 'staging', 'https://b.example.com');
    const path = await tempConfigPath(config);
    const out = collect();
    await profileUse('staging', fakeDeps(path, { out: out.out }));
    expect(out.lines[0]).toBe('Active profile is now "staging" (https://b.example.com)');
    expect((await loadConfig(path)).activeProfile).toBe('staging');
  });

  it('exits 4 for an unknown profile', async () => {
    const path = await tempConfigPath({ version: 1, activeProfile: null, profiles: {} });
    const err = await captureError(profileUse('nope', fakeDeps(path)));
    expect(err.exitCode).toBe(4);
    expect(err.message).toBe('no profile named "nope"');
  });
});

describe('profileRemove', () => {
  it('exits 4 for an unknown profile', async () => {
    const path = await tempConfigPath({ version: 1, activeProfile: null, profiles: {} });
    const err = await captureError(profileRemove('nope', {}, fakeDeps(path)));
    expect(err.exitCode).toBe(4);
  });

  it('refuses while the profile still has a session, before any confirmation', async () => {
    const config = setSession(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
      session,
    );
    const path = await tempConfigPath(config);
    const err = await captureError(profileRemove('prod', {}, fakeDeps(path)));
    expect(err.exitCode).toBe(1);
    expect(err.message).toBe(
      'profile "prod" is still logged in; run `mcid-cli logout --profile prod` first',
    );
    expect(await loadConfig(path)).toEqual(config);
  });

  it('refuses without --yes when secrets are stored and there is no interactive terminal', async () => {
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    const path = await tempConfigPath(config);
    const err = await captureError(
      profileRemove('prod', {}, fakeDeps(path, { isInteractive: false })),
    );
    expect(err.exitCode).toBe(1);
    expect(await loadConfig(path)).toEqual(config);
  });

  it('asks for confirmation when secrets are stored and interactive, and aborts on anything but y/yes', async () => {
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    const path = await tempConfigPath(config);
    const err = await captureError(
      profileRemove('prod', {}, fakeDeps(path, { isInteractive: true, ask: async () => 'n' })),
    );
    expect(err.message).toBe('aborted; nothing was removed');
    expect(await loadConfig(path)).toEqual(config);
  });

  it('removes on "y" confirmation, dropping the webhook secrets with it', async () => {
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    const path = await tempConfigPath(config);
    const out = collect();
    await profileRemove(
      'prod',
      {},
      fakeDeps(path, { out: out.out, isInteractive: true, ask: async () => 'y' }),
    );
    expect(out.lines[0]).toBe('Removed profile "prod"; active profile is now unset');
    expect(await loadConfig(path)).toEqual({ version: 1, activeProfile: null, profiles: {} });
  });

  it('--yes skips the prompt entirely and still removes', async () => {
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    const path = await tempConfigPath(config);
    const ask = async () => {
      throw new Error('should not be asked');
    };
    const out = collect();
    await profileRemove(
      'prod',
      { yes: true },
      fakeDeps(path, { out: out.out, isInteractive: true, ask }),
    );
    expect(out.lines[0]).toBe('Removed profile "prod"; active profile is now unset');
  });

  it('removes a non-active profile without touching activeProfile or other profiles', async () => {
    let config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
    );
    config = addProfile(config, 'staging', 'https://b.example.com');
    const path = await tempConfigPath(config);
    const out = collect();
    await profileRemove('staging', {}, fakeDeps(path, { out: out.out }));
    expect(out.lines[0]).toBe('Removed profile "staging"');
    const after = await loadConfig(path);
    expect(after.activeProfile).toBe('prod');
    expect(after.profiles.prod).toEqual(config.profiles.prod);
    expect(after.profiles.staging).toBeUndefined();
  });
});
