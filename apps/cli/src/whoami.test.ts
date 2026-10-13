import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyConfig, saveConfig, setSession } from './config.js';
import { encrypt, sessionContext } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { fakeMcdi, json } from './test-support/fake-mcdi.js';
import { fixedKeys } from './test-support/keys.js';
import { whoami } from './whoami.js';

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const keys = fixedKeys();
  const configPath = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-whoami-')), 'config.json');
  const session = {
    accessToken: await encrypt('session-token', keys, sessionContext('prod')),
    expiresAt: '2026-10-20T00:00:00.000Z',
    adminIdentity: 'kal#42',
  };
  await saveConfig(
    setSession(emptyConfig(), 'prod', 'https://mcdi.example.com', session),
    configPath,
  );
  const lines: string[] = [];
  return { deps: { configPath, keys, out: (l: string) => lines.push(l) }, lines };
}

describe('whoami', () => {
  it('prints who the session belongs to, sending the token only as a bearer header', async () => {
    const { deps, lines } = await setup();
    fakeMcdi({
      'GET /auth/admin/me': (_url, init) => {
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
        return json({ id: '42', username: 'kal', globalName: 'Kal', sessionExpiresAt: 'soon' });
      },
    });
    await whoami({ profile: 'prod' }, deps);
    expect(lines[0]).toBe('Logged in as Kal (kal) on prod');
    expect(lines.join('\n')).not.toContain('session-token');
  });

  it('exits with an auth error when the session expired', async () => {
    const { deps } = await setup();
    fakeMcdi({ 'GET /auth/admin/me': () => new Response('', { status: 401 }) });
    const err = await whoami({ profile: 'prod' }, deps).catch((e: unknown) => e);
    expect((err as CliError).exitCode).toBe(ExitCode.Auth);
    expect((err as CliError).message).toContain('mcdi-cli login --profile prod');
  });
});
