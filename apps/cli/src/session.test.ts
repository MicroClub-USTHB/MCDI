import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { emptyConfig, setSession } from './config.js';
import { encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { resolveSession } from './session.js';

const fixedKey = (key = randomBytes(32)): KeyProvider => ({ getKey: async () => key });

async function expectAuthError(promise: Promise<unknown>, message: RegExp) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CliError);
  expect((err as CliError).exitCode).toBe(ExitCode.Auth);
  expect((err as CliError).message).toMatch(message);
}

describe('resolveSession', () => {
  it('returns the decrypted token, base URL and profile name', async () => {
    const keys = fixedKey();
    const session = {
      accessToken: await encrypt('session-token', keys),
      expiresAt: '2026-10-05T00:00:00.000Z',
      adminIdentity: 'kal#1',
    };
    const config = setSession(emptyConfig(), 'prod', 'https://mcdi.example.com', session);

    expect(await resolveSession(config, 'prod', keys)).toEqual({
      profileName: 'prod',
      baseUrl: 'https://mcdi.example.com',
      token: 'session-token',
    });
  });

  it('errors with a login hint when the profile does not exist', async () => {
    await expectAuthError(
      resolveSession(emptyConfig(), 'ghost', fixedKey()),
      /not logged in on profile "ghost"[\s\S]*mcdi-cli login --profile ghost/,
    );
  });

  it('errors with a login hint when the profile has no session', async () => {
    const config = { ...emptyConfig(), profiles: { prod: { baseUrl: 'https://a.example.com', session: null } } };
    await expectAuthError(
      resolveSession(config, 'prod', fixedKey()),
      /not logged in on profile "prod"[\s\S]*mcdi-cli login --profile prod/,
    );
  });

  it('errors with a re-login hint when the stored session cannot be decrypted', async () => {
    const encryptKey = fixedKey();
    const session = {
      accessToken: await encrypt('session-token', encryptKey),
      expiresAt: '2026-10-05T00:00:00.000Z',
      adminIdentity: 'kal#1',
    };
    const config = setSession(emptyConfig(), 'prod', 'https://mcdi.example.com', session);

    await expectAuthError(
      resolveSession(config, 'prod', fixedKey()),
      /could not decrypt the stored session for profile "prod"[\s\S]*mcdi-cli login --profile prod.*again/,
    );
  });
});
