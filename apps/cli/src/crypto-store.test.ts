import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  FallbackKeyProvider,
  FileKeyStore,
  KeyUnavailableError,
  decrypt,
  encrypt,
  type KeyStore,
} from './crypto-store.js';
import { fixedKeys } from './test-support/keys.js';

const CONTEXT = 'prod/session';
const tempDir = () => mkdtemp(join(tmpdir(), 'mcid-cli-crypto-'));
const store = (key = randomBytes(32)): KeyStore => ({ getKey: async () => key });
const broken = (message = 'no secret service'): KeyStore => ({
  getKey: () => Promise.reject(new Error(message)),
});

describe('encrypt/decrypt', () => {
  it('round-trips a value', async () => {
    const keys = fixedKeys();
    const encoded = await encrypt('session-token-123', keys, CONTEXT);
    expect(await decrypt(encoded, keys, CONTEXT)).toBe('session-token-123');
  });

  it('never contains the plaintext, records the key source and uses a fresh IV each time', async () => {
    const keys = fixedKeys();
    const a = await encrypt('session-token-123', keys, CONTEXT);
    const b = await encrypt('session-token-123', keys, CONTEXT);
    expect(a).not.toContain('session-token-123');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1:kc:')).toBe(true);
  });

  it('fails with the wrong key', async () => {
    const encoded = await encrypt('secret', fixedKeys(), CONTEXT);
    await expect(decrypt(encoded, fixedKeys(), CONTEXT)).rejects.toThrow();
  });

  it('fails when the value is moved to another slot', async () => {
    const keys = fixedKeys();
    const encoded = await encrypt('session-token', keys, 'prod/session');
    await expect(decrypt(encoded, keys, 'prod/webhook/wh-1')).rejects.toThrow();
  });

  it('fails when the ciphertext was tampered with', async () => {
    const keys = fixedKeys();
    const [format, source, iv, tag, ct] = (await encrypt('secret', keys, CONTEXT)).split(':');
    const flipped = Buffer.from(ct!, 'base64');
    flipped[0]! ^= 1;
    await expect(
      decrypt([format, source, iv, tag, flipped.toString('base64')].join(':'), keys, CONTEXT),
    ).rejects.toThrow();
  });

  it('rejects a truncated authentication tag', async () => {
    const keys = fixedKeys();
    const [format, source, iv, tag, ct] = (await encrypt('secret', keys, CONTEXT)).split(':');
    const short = Buffer.from(tag!, 'base64').subarray(0, 4).toString('base64');
    await expect(decrypt([format, source, iv, short, ct].join(':'), keys, CONTEXT)).rejects.toThrow(
      'unrecognized encrypted value format',
    );
  });

  it('rejects values that are not in the v1 format', async () => {
    for (const value of ['plaintext-token', 'v1:a:b:c', 'v1:xx:a:b:c', 'v2:kc:a:b:c']) {
      await expect(decrypt(value, fixedKeys(), CONTEXT)).rejects.toThrow(
        'unrecognized encrypted value format',
      );
    }
  });
});

describe('FileKeyStore', () => {
  it('creates a 0600 key file once and reuses it', async () => {
    const path = join(await tempDir(), 'nested', 'key');
    const first = await new FileKeyStore(path).getKey();
    const second = await new FileKeyStore(path).getKey();

    expect(first).toHaveLength(32);
    expect(second.equals(first)).toBe(true);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(Buffer.from(await readFile(path, 'utf8'), 'base64').equals(first)).toBe(true);
  });

  it('gives concurrent first uses the same key', async () => {
    const path = join(await tempDir(), 'key');
    const keys = await Promise.all([1, 2, 3].map(() => new FileKeyStore(path).getKey()));
    expect(keys.every((key) => key.equals(keys[0]!))).toBe(true);
  });

  it('rejects a malformed key file instead of using it', async () => {
    const path = join(await tempDir(), 'key');
    await writeFile(path, 'not-a-key');
    await expect(new FileKeyStore(path).getKey()).rejects.toThrow('malformed');
  });
});

describe('FallbackKeyProvider', () => {
  const provider = (keychain: KeyStore, file: KeyStore, warn = vi.fn()) =>
    new FallbackKeyProvider(keychain, file, '/home/me/.mcid-cli/key', warn);

  it('encrypts with the keychain when it works, without touching the key file', async () => {
    const file = { getKey: vi.fn() };
    const keys = provider(store(), file);
    expect((await encrypt('secret', keys, CONTEXT)).startsWith('v1:kc:')).toBe(true);
    expect(file.getKey).not.toHaveBeenCalled();
  });

  it('falls back to the key file while the keychain is unavailable, warning once per run', async () => {
    const warn = vi.fn();
    const keys = provider(broken(), store(), warn);
    expect((await encrypt('a', keys, CONTEXT)).startsWith('v1:file:')).toBe(true);
    await encrypt('b', keys, CONTEXT);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('no secret service');
  });

  it('decrypts a key-file value with the key file even once the keychain works again', async () => {
    const file = store();
    const encoded = await encrypt('signing-secret', provider(broken(), file), CONTEXT);
    expect(await decrypt(encoded, provider(store(), file), CONTEXT)).toBe('signing-secret');
  });

  it('never decrypts a keychain value with the key file', async () => {
    const keychain = store();
    const encoded = await encrypt('signing-secret', provider(keychain, store()), CONTEXT);
    await expect(
      decrypt(encoded, provider(broken('keychain is locked'), store()), CONTEXT),
    ).rejects.toThrow(KeyUnavailableError);
    expect(await decrypt(encoded, provider(keychain, store()), CONTEXT)).toBe('signing-secret');
  });

  it('asks each store once per process, and retries one that failed', async () => {
    const keychain = { getKey: vi.fn(async () => randomBytes(32)) };
    const keys = provider(keychain, store());
    const [a, b] = await Promise.all([keys.keyFor('keychain'), keys.keyFor('keychain')]);
    expect(a.equals(b)).toBe(true);
    expect(keychain.getKey).toHaveBeenCalledTimes(1);

    const flaky = { getKey: vi.fn().mockRejectedValueOnce(new Error('locked')) };
    flaky.getKey.mockResolvedValue(randomBytes(32));
    const retrying = provider(flaky, store());
    await expect(retrying.keyFor('keychain')).rejects.toThrow('locked');
    await expect(retrying.keyFor('keychain')).resolves.toHaveLength(32);
  });
});
