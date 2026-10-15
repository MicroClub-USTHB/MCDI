import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addProfile, saveConfig, setSession, setWebhookSecret, type Config } from './config.js';
import { configShow, configShowPath, redactProfile, type ConfigDeps } from './config-show.js';
import { CliError } from './errors.js';

const session = {
  accessToken: 'v1:aaa:bbb:ccc',
  expiresAt: '2026-10-05T00:00:00.000Z',
  adminIdentity: 'kal#1',
};
const secretEntry = { secret: 'v1:s:e:c', name: 'Recruitment', slug: 'recruitment' };

async function tempConfigPath(config: Config): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), 'mcid-cli-config-show-')), 'config.json');
  await saveConfig(config, path);
  return path;
}

function fakeDeps(configPath: string, overrides: Partial<ConfigDeps> = {}): ConfigDeps {
  return { configPath, out: () => {}, ...overrides };
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

describe('configShowPath', () => {
  it('prints exactly the configured path, without touching the filesystem', () => {
    const out = collect();
    configShowPath(fakeDeps('/tmp/does/not/exist/config.json', { out: out.out }));
    expect(out.lines).toEqual(['/tmp/does/not/exist/config.json']);
  });
});

describe('redactProfile', () => {
  it('replaces the session access token and every webhook secret, keeping everything else', () => {
    let config = setSession(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
      session,
    );
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    const redacted = redactProfile(config.profiles.prod!);
    expect(redacted).toEqual({
      baseUrl: 'https://a.example.com',
      session: { ...session, accessToken: '<encrypted>' },
      webhookSecrets: { 'wh-1': { ...secretEntry, secret: '<encrypted>' } },
    });
  });

  it('leaves a profile with no session or secrets alone', () => {
    const profile = { baseUrl: 'https://a.example.com', session: null };
    expect(redactProfile(profile)).toEqual(profile);
  });
});

describe('configShow', () => {
  it('prints the resolved profile with secrets redacted and never the raw fake-encrypted strings', async () => {
    let config = setSession(
      { version: 1, activeProfile: null, profiles: {} },
      'prod',
      'https://a.example.com',
      session,
    );
    config = setWebhookSecret(config, 'prod', 'wh-1', secretEntry);
    const path = await tempConfigPath(config);
    const bytesBefore = await readFile(path);

    const out = collect();
    await configShow({ profile: 'prod' }, fakeDeps(path, { out: out.out }));
    const text = out.lines.join('\n');

    expect(text).not.toContain('v1:aaa:bbb:ccc');
    expect(text).not.toContain('v1:s:e:c');
    expect(text).not.toContain('v1:');
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({
      name: 'prod',
      active: true,
      baseUrl: 'https://a.example.com',
      session: { ...session, accessToken: '<encrypted>' },
      webhookSecrets: { 'wh-1': { ...secretEntry, secret: '<encrypted>' } },
    });

    expect(await readFile(path)).toEqual(bytesBefore);
  });

  it('falls back to the active profile, then "default"', async () => {
    const config = addProfile(
      { version: 1, activeProfile: null, profiles: {} },
      'staging',
      'https://b.example.com',
    );
    const path = await tempConfigPath(config);
    const out = collect();
    await configShow({}, fakeDeps(path, { out: out.out }));
    expect(JSON.parse(out.lines.join('\n'))).toEqual({
      name: 'staging',
      active: true,
      baseUrl: 'https://b.example.com',
      session: null,
    });
  });

  it('exits 4 for an unknown profile', async () => {
    const path = await tempConfigPath({ version: 1, activeProfile: null, profiles: {} });
    const err = await captureError(configShow({ profile: 'nope' }, fakeDeps(path)));
    expect(err.exitCode).toBe(4);
    expect(err.message).toBe('no profile named "nope"');
  });
});
