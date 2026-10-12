import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addProfile,
  clearSession,
  configDir,
  configPath,
  emptyConfig,
  isValidProfileName,
  loadConfig,
  normalizeBaseUrl,
  removeProfile,
  resolveBaseUrl,
  resolveProfileName,
  saveConfig,
  setActiveProfile,
  setSession,
  setWebhookSecret,
  removeWebhookSecret,
  type Config,
} from './config.js';
import { CliError } from './errors.js';

const tempPath = async () =>
  join(await mkdtemp(join(tmpdir(), 'mcdi-cli-config-')), 'sub', 'config.json');
const session = {
  accessToken: 'v1:enc',
  expiresAt: '2026-10-05T00:00:00.000Z',
  adminIdentity: 'kal#1',
};

describe('configPath', () => {
  it('honours MCDI_CLI_CONFIG_PATH', () => {
    expect(configPath({ MCDI_CLI_CONFIG_PATH: '/tmp/x.json' })).toBe('/tmp/x.json');
  });

  it('defaults to ~/.mcdi-cli/config.json', () => {
    expect(configPath({})).toMatch(/\.mcdi-cli[/\\]config\.json$/);
  });
});

describe('configDir', () => {
  it('follows MCDI_CLI_CONFIG_PATH, so the key file and global rules move with the config', () => {
    expect(configDir({ MCDI_CLI_CONFIG_PATH: '/ci/state/config.json' })).toBe('/ci/state');
  });

  it('defaults to ~/.mcdi-cli', () => {
    expect(configDir({})).toMatch(/\.mcdi-cli$/);
  });
});

describe('loadConfig/saveConfig', () => {
  it('returns an empty config when the file does not exist', async () => {
    expect(await loadConfig(await tempPath())).toEqual(emptyConfig());
  });

  it('round-trips and writes the file with mode 0600', async () => {
    const path = await tempPath();
    const config = setSession(emptyConfig(), 'prod', 'https://mcdi.example.com', session);
    await saveConfig(config, path);

    expect(await loadConfig(path)).toEqual(config);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(config);
  });

  it('rejects invalid JSON and unknown versions', async () => {
    const path = await tempPath();
    await saveConfig(emptyConfig(), path);
    await writeFile(path, '{ nope');
    await expect(loadConfig(path)).rejects.toThrow(CliError);
    await writeFile(path, JSON.stringify({ version: 2, profiles: {} }));
    await expect(loadConfig(path)).rejects.toThrow('unsupported shape');
  });
});

describe('resolveProfileName', () => {
  const config: Config = { ...emptyConfig(), activeProfile: 'staging' };

  it('prefers --profile, then the active profile, then "default"', () => {
    expect(resolveProfileName(config, 'prod')).toBe('prod');
    expect(resolveProfileName(config, undefined)).toBe('staging');
    expect(resolveProfileName(emptyConfig(), undefined)).toBe('default');
  });
});

describe('resolveBaseUrl', () => {
  const config = setSession(emptyConfig(), 'prod', 'https://saved.example.com', session);

  it('prefers --base-url, then the profile, and normalizes trailing slashes', () => {
    expect(resolveBaseUrl(config, 'prod', 'https://flag.example.com/')).toBe(
      'https://flag.example.com',
    );
    expect(resolveBaseUrl(config, 'prod', undefined)).toBe('https://saved.example.com');
  });

  it('errors with guidance when nothing provides a base URL', () => {
    expect(() => resolveBaseUrl(config, 'new', undefined)).toThrow('--base-url');
  });

  it('rejects invalid and non-http URLs', () => {
    expect(() => normalizeBaseUrl('not a url')).toThrow('invalid base URL');
    expect(() => normalizeBaseUrl('file:///etc/passwd')).toThrow('must be http(s)');
  });
});

describe('setSession', () => {
  it('keeps stored webhook secrets when logging in again', () => {
    const secrets = { 'wh-1': { secret: 'v1:enc', name: 'Recruitment', slug: 'recruitment' } };
    const before = setWebhookSecret(
      setSession(emptyConfig(), 'prod', 'https://a.example.com', session),
      'prod',
      'wh-1',
      secrets['wh-1'],
    );
    const after = setSession(before, 'prod', 'https://a.example.com', {
      ...session,
      accessToken: 'v1:new',
    });
    expect(after.profiles.prod).toEqual({
      baseUrl: 'https://a.example.com',
      session: { ...session, accessToken: 'v1:new' },
      webhookSecrets: secrets,
    });
  });

  it('makes the first profile active without touching the others', () => {
    const first = setSession(emptyConfig(), 'prod', 'https://a.example.com', session);
    const second = setSession(
      {
        ...first,
        profiles: { ...first.profiles, local: { baseUrl: 'http://localhost:3000', session: null } },
      },
      'staging',
      'https://b.example.com',
      session,
    );
    expect(first.activeProfile).toBe('prod');
    expect(second.activeProfile).toBe('prod');
    expect(Object.keys(second.profiles).sort()).toEqual(['local', 'prod', 'staging']);
    expect(second.profiles.local).toEqual({ baseUrl: 'http://localhost:3000', session: null });
  });
});

describe('clearSession', () => {
  it("nulls out the named profile's session, keeping its baseUrl and other profiles/activeProfile untouched", () => {
    let config = setSession(emptyConfig(), 'prod', 'https://a.example.com', session);
    config = setSession(config, 'staging', 'https://b.example.com', session);
    config = { ...config, activeProfile: 'staging' };

    const cleared = clearSession(config, 'prod');

    expect(cleared.profiles.prod).toEqual({ baseUrl: 'https://a.example.com', session: null });
    expect(cleared.profiles.staging).toEqual(config.profiles.staging);
    expect(cleared.activeProfile).toBe('staging');
  });

  it('is a no-op when the profile does not exist', () => {
    const config = setSession(emptyConfig(), 'prod', 'https://a.example.com', session);
    expect(clearSession(config, 'ghost')).toEqual(config);
  });
});

describe('setWebhookSecret', () => {
  it('overwrites an existing entry for the same webhook id, keeping the session and other secrets', () => {
    const other = { secret: 'v1:other', name: 'Other', slug: 'other' };
    const original = { secret: 'v1:old', name: 'Recruitment', slug: 'recruitment' };
    const rotated = { secret: 'v1:new', name: 'Recruitment', slug: 'recruitment' };

    let config = setSession(emptyConfig(), 'prod', 'https://a.example.com', session);
    config = setWebhookSecret(config, 'prod', 'wh-1', original);
    config = setWebhookSecret(config, 'prod', 'wh-2', other);
    const after = setWebhookSecret(config, 'prod', 'wh-1', rotated);

    expect(after.profiles.prod!.webhookSecrets).toEqual({ 'wh-1': rotated, 'wh-2': other });
    expect(after.profiles.prod!.session).toEqual(session);
  });

  it('errors when the profile does not exist', () => {
    expect(() =>
      setWebhookSecret(emptyConfig(), 'ghost', 'wh-1', { secret: 'v1:x', name: 'N', slug: 's' }),
    ).toThrow(CliError);
  });
});

describe('removeWebhookSecret', () => {
  const entry = { secret: 'v1:enc', name: 'Recruitment', slug: 'recruitment' };
  const base = setWebhookSecret(
    setWebhookSecret(
      setSession(emptyConfig(), 'prod', 'https://a.example.com', session),
      'prod',
      'wh-1',
      entry,
    ),
    'prod',
    'wh-2',
    entry,
  );

  it('drops only that webhook, keeping the session', () => {
    const after = removeWebhookSecret(base, 'prod', 'wh-1')!;
    expect(Object.keys(after.profiles.prod!.webhookSecrets!)).toEqual(['wh-2']);
    expect(after.profiles.prod!.session).toEqual(session);
  });

  it('returns null when there is nothing to drop', () => {
    expect(removeWebhookSecret(base, 'prod', 'wh-9')).toBeNull();
    expect(removeWebhookSecret(base, 'staging', 'wh-1')).toBeNull();
    expect(removeWebhookSecret(emptyConfig(), 'prod', 'wh-1')).toBeNull();
  });
});

describe('isValidProfileName', () => {
  it('accepts letters, digits, "_" and "-", 1-64 characters', () => {
    expect(isValidProfileName('prod')).toBe(true);
    expect(isValidProfileName('staging-2')).toBe(true);
    expect(isValidProfileName('a_b')).toBe(true);
    expect(isValidProfileName('x'.repeat(64))).toBe(true);
  });

  it('rejects empty, overlong, or specially-charactered names', () => {
    expect(isValidProfileName('')).toBe(false);
    expect(isValidProfileName('x'.repeat(65))).toBe(false);
    expect(isValidProfileName('has space')).toBe(false);
    expect(isValidProfileName('has/slash')).toBe(false);
    expect(isValidProfileName('has.dot')).toBe(false);
  });
});

describe('addProfile', () => {
  it('adds a profile with no session, becoming active only when none is active yet', () => {
    const first = addProfile(emptyConfig(), 'prod', 'https://a.example.com');
    expect(first.profiles.prod).toEqual({ baseUrl: 'https://a.example.com', session: null });
    expect(first.activeProfile).toBe('prod');

    const second = addProfile(first, 'staging', 'https://b.example.com');
    expect(second.activeProfile).toBe('prod');
    expect(second.profiles.staging).toEqual({ baseUrl: 'https://b.example.com', session: null });
    expect(second.profiles.prod).toEqual(first.profiles.prod);
  });

  it('rejects an invalid name before touching the config', () => {
    expect(() => addProfile(emptyConfig(), 'has space', 'https://a.example.com')).toThrow(CliError);
    expect(() => addProfile(emptyConfig(), '', 'https://a.example.com')).toThrow(CliError);
  });

  it('refuses a name that already exists, leaving the existing profile untouched', () => {
    const config = addProfile(emptyConfig(), 'prod', 'https://a.example.com');
    expect(() => addProfile(config, 'prod', 'https://different.example.com')).toThrow(
      'already exists',
    );
  });
});

describe('setActiveProfile', () => {
  it('switches the active profile without touching any profile data', () => {
    let config = addProfile(emptyConfig(), 'prod', 'https://a.example.com');
    config = addProfile(config, 'staging', 'https://b.example.com');
    const updated = setActiveProfile(config, 'staging');
    expect(updated.activeProfile).toBe('staging');
    expect(updated.profiles).toEqual(config.profiles);
  });

  it('throws "no profile named" for an unknown profile', () => {
    expect(() => setActiveProfile(emptyConfig(), 'ghost')).toThrow('no profile named "ghost"');
  });
});

describe('removeProfile', () => {
  it('removes the profile and leaves others and activeProfile untouched when it was not active', () => {
    let config = addProfile(emptyConfig(), 'prod', 'https://a.example.com');
    config = addProfile(config, 'staging', 'https://b.example.com');
    config = setActiveProfile(config, 'prod');

    const updated = removeProfile(config, 'staging');
    expect(Object.keys(updated.profiles)).toEqual(['prod']);
    expect(updated.activeProfile).toBe('prod');
    expect(updated.profiles.prod).toEqual(config.profiles.prod);
  });

  it('nulls activeProfile when the removed profile was active', () => {
    const config = addProfile(emptyConfig(), 'prod', 'https://a.example.com');
    const updated = removeProfile(config, 'prod');
    expect(updated.profiles).toEqual({});
    expect(updated.activeProfile).toBeNull();
  });

  it('throws "no profile named" for an unknown profile', () => {
    expect(() => removeProfile(emptyConfig(), 'ghost')).toThrow('no profile named "ghost"');
  });
});
