import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { emptyConfig, saveConfig, setSession } from './config.js';
import { encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { maskSecret, slugFromName, webhookCreate, webhookRotateSecret, type WebhookDeps } from './webhook-flow.js';

describe('slugFromName', () => {
  it('lowercases, strips accents, and collapses everything else to single dashes', () => {
    expect(slugFromName('Recruitment 2027')).toBe('recruitment-2027');
    expect(slugFromName('  Événement — Été!! ')).toBe('evenement-ete');
    expect(slugFromName('x'.repeat(80))).toHaveLength(64);
    expect(slugFromName('!!')).toBe('');
  });
});

describe('maskSecret', () => {
  it('shows only the last 4 characters of a secret longer than 8', () => {
    expect(maskSecret('whsec_abcdefghij')).toBe('********ghij');
  });

  it('fully masks a secret of 8 characters or fewer', () => {
    expect(maskSecret('short')).toBe('********');
    expect(maskSecret('')).toBe('********');
  });
});

describe('webhookRotateSecret confirmation', () => {
  const fixedKey = (key = randomBytes(32)): KeyProvider => ({ getKey: async () => key });

  async function seededConfigPath(keys: KeyProvider, baseUrl: string): Promise<string> {
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-rotate-')), 'config.json');
    const session = {
      accessToken: await encrypt('session-token', keys),
      expiresAt: '2026-10-05T00:00:00.000Z',
      adminIdentity: 'kal#1',
    };
    await saveConfig(setSession(emptyConfig(), 'prod', baseUrl, session), path);
    return path;
  }

  function fakeDeps(configPath: string, keys: KeyProvider, overrides: Partial<WebhookDeps> = {}): WebhookDeps {
    return {
      configPath,
      keys,
      out: () => {},
      info: () => {},
      isInteractive: false,
      ask: async () => '',
      ...overrides,
    };
  }

  async function captureError(promise: Promise<unknown>): Promise<CliError> {
    const err = await promise.then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CliError);
    return err as CliError;
  }

  // These all target an unreachable loopback port (http://127.0.0.1:9 — "discard", nothing listens
  // for TCP there) rather than any mock/fake MCDI server, so the assertions below prove whether a
  // network call was attempted at all: a confirmation refusal never reaches `request()`, so it never
  // produces "could not reach MCDI"; only a confirmed rotation does.
  const UNREACHABLE = 'http://127.0.0.1:9';

  it('refuses without --yes when there is no interactive terminal, before any network call', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const deps = fakeDeps(path, keys, { isInteractive: false });

    const err = await captureError(webhookRotateSecret('wh-1', { profile: 'prod' }, deps));
    expect(err.exitCode).toBe(ExitCode.PrecheckFailed);
    expect(err.message).toBe(
      'refusing to rotate without confirmation and there is no interactive terminal to ask; pass --yes to confirm',
    );
  });

  it('aborts on "n", before any network call', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const ask = vi.fn(async () => 'n');
    const deps = fakeDeps(path, keys, { isInteractive: true, ask });

    const err = await captureError(webhookRotateSecret('wh-1', { profile: 'prod' }, deps));
    expect(err.exitCode).toBe(ExitCode.PrecheckFailed);
    expect(err.message).toBe('aborted; nothing was rotated');
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('proceeds to the network step on "y", failing there with a network error, not the confirmation refusal', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const deps = fakeDeps(path, keys, { isInteractive: true, ask: async () => 'y' });

    const err = await captureError(webhookRotateSecret('wh-1', { profile: 'prod' }, deps));
    expect(err.exitCode).toBe(ExitCode.Unexpected);
    expect(err.message).toMatch(/could not reach MCDI/);
  });

  it('proceeds to the network step on "yes" too', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const deps = fakeDeps(path, keys, { isInteractive: true, ask: async () => 'yes' });

    const err = await captureError(webhookRotateSecret('wh-1', { profile: 'prod' }, deps));
    expect(err.exitCode).toBe(ExitCode.Unexpected);
    expect(err.message).toMatch(/could not reach MCDI/);
  });

  it('--yes skips the prompt entirely and still reaches the network step', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const ask = vi.fn();
    const deps = fakeDeps(path, keys, { isInteractive: true, ask });

    const err = await captureError(webhookRotateSecret('wh-1', { profile: 'prod', yes: true }, deps));
    expect(ask).not.toHaveBeenCalled();
    expect(err.exitCode).toBe(ExitCode.Unexpected);
    expect(err.message).toMatch(/could not reach MCDI/);
  });
});

describe('webhookCreate: optional --project and --roles', () => {
  const fixedKey = (key = randomBytes(32)): KeyProvider => ({ getKey: async () => key });
  const UNREACHABLE = 'http://127.0.0.1:9';

  async function seededConfigPath(keys: KeyProvider, baseUrl: string): Promise<string> {
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-create-')), 'config.json');
    const session = {
      accessToken: await encrypt('session-token', keys),
      expiresAt: '2026-10-05T00:00:00.000Z',
      adminIdentity: 'kal#1',
    };
    await saveConfig(setSession(emptyConfig(), 'prod', baseUrl, session), path);
    return path;
  }

  async function seededSchemaPath(): Promise<string> {
    const path = join(await mkdtemp(join(tmpdir(), 'mcdi-cli-create-schema-')), 'schema.json');
    await writeFile(
      path,
      JSON.stringify({ version: 1, steps: [{ key: 'default', fields: [{ key: 'name', type: 'string', required: true, maxLength: 80 }] }] }),
    );
    return path;
  }

  function fakeDeps(configPath: string, keys: KeyProvider, overrides: Partial<WebhookDeps> = {}): WebhookDeps {
    return {
      configPath,
      keys,
      out: () => {},
      info: () => {},
      isInteractive: false,
      ask: async () => '',
      ...overrides,
    };
  }

  async function captureError(promise: Promise<unknown>): Promise<CliError> {
    const err = await promise.then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CliError);
    return err as CliError;
  }

  it('refuses to pick a project without an interactive terminal, before any network call', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const schemaPath = await seededSchemaPath();
    const deps = fakeDeps(path, keys, { isInteractive: false });

    const err = await captureError(
      webhookCreate(schemaPath, { profile: 'prod', name: 'Test', acceptOrigin: [] }, deps),
    );
    expect(err.exitCode).toBe(ExitCode.PrecheckFailed);
    expect(err.message).toBe('no interactive terminal to pick a project; pass --project <projectId>');
  });

  it('omitting --roles does not block locally; the request still reaches MCDI', async () => {
    const keys = fixedKey();
    const path = await seededConfigPath(keys, UNREACHABLE);
    const schemaPath = await seededSchemaPath();
    const deps = fakeDeps(path, keys, { isInteractive: false });

    const err = await captureError(
      webhookCreate(schemaPath, { profile: 'prod', name: 'Test', project: 'proj-1', acceptOrigin: [] }, deps),
    );
    expect(err.exitCode).toBe(ExitCode.Unexpected);
    expect(err.message).toMatch(/could not reach MCDI/);
  });
});
