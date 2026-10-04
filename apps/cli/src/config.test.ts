import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clearSession,
  configPath,
  emptyConfig,
  loadConfig,
  normalizeBaseUrl,
  resolveBaseUrl,
  resolveProfileName,
  saveConfig,
  setSession,
  setWebhookSecret,
  type Config,
} from './config.js';
import { CliError } from './errors.js';

const tempPath = async () => join(await mkdtemp(join(tmpdir(), 'm-forge-config-')), 'sub', 'config.json');
const session = { accessToken: 'v1:enc', expiresAt: '2026-10-05T00:00:00.000Z', adminIdentity: 'kal#1' };

describe('configPath', () => {
  it('honours MFORGE_CONFIG_PATH', () => {
    expect(configPath({ MFORGE_CONFIG_PATH: '/tmp/x.json' })).toBe('/tmp/x.json');
  });

  it('defaults to ~/.m-forge/config.json', () => {
    expect(configPath({})).toMatch(/\.m-forge[/\\]config\.json$/);
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
    expect(resolveBaseUrl(config, 'prod', 'https://flag.example.com/')).toBe('https://flag.example.com');
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
    const before = setWebhookSecret(setSession(emptyConfig(), 'prod', 'https://a.example.com', session), 'prod', 'wh-1', secrets['wh-1']);
    const after = setSession(before, 'prod', 'https://a.example.com', { ...session, accessToken: 'v1:new' });
    expect(after.profiles.prod).toEqual({ baseUrl: 'https://a.example.com', session: { ...session, accessToken: 'v1:new' }, webhookSecrets: secrets });
  });

  it('makes the first profile active without touching the others', () => {
    const first = setSession(emptyConfig(), 'prod', 'https://a.example.com', session);
    const second = setSession(
      { ...first, profiles: { ...first.profiles, local: { baseUrl: 'http://localhost:3000', session: null } } },
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
  it('nulls out the named profile\'s session, keeping its baseUrl and other profiles/activeProfile untouched', () => {
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
