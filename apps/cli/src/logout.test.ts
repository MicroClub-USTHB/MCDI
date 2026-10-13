import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyConfig, loadConfig, saveConfig, setSession } from './config.js';
import { encrypt, sessionContext, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { logout } from './logout.js';
import { fixedKeys } from './test-support/keys.js';

async function loggedIn(keys: KeyProvider): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-logout-')), 'config.json');
  const session = {
    accessToken: await encrypt('session-token', keys, sessionContext('prod')),
    expiresAt: '2026-10-05T00:00:00.000Z',
    adminIdentity: 'kal#1',
  };
  await saveConfig(setSession(emptyConfig(), 'prod', 'https://mcdi.example.com', session), path);
  return path;
}

const deps = (configPath: string, keys: KeyProvider) => ({
  configPath,
  keys,
  out: () => {},
  warn: () => {},
});

describe('logout', () => {
  it('keeps the session when the keychain is locked, so it can still be revoked later', async () => {
    const path = await loggedIn(fixedKeys());
    const locked: KeyProvider = {
      keyForWrite: () => Promise.reject(new Error('locked')),
      keyFor: () => Promise.reject(new Error('User interaction is not allowed')),
    };

    const err = await logout({ profile: 'prod' }, deps(path, locked)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).exitCode).toBe(ExitCode.Auth);
    expect((err as CliError).message).toContain('unlock it and try again');
    expect((await loadConfig(path)).profiles.prod!.session).not.toBeNull();
  });

  it('clears a session that cannot be decrypted, and says it was not revoked', async () => {
    const path = await loggedIn(fixedKeys());
    const warnings: string[] = [];
    await logout(
      { profile: 'prod' },
      { ...deps(path, fixedKeys()), warn: (line) => warnings.push(line) },
    );
    expect((await loadConfig(path)).profiles.prod!.session).toBeNull();
    expect(warnings.join('\n')).toContain('could not be revoked');
  });
});
