import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  DefaultKeyProvider,
  FileKeyProvider,
  decrypt,
  encrypt,
  type KeyProvider,
} from './crypto-store.js';

const fixedKey = (key = randomBytes(32)): KeyProvider => ({ getKey: async () => key });
const tempDir = () => mkdtemp(join(tmpdir(), 'mcdi-cli-crypto-'));

describe('encrypt/decrypt', () => {
  it('round-trips a value', async () => {
    const keys = fixedKey();
    const encoded = await encrypt('session-token-123', keys);
    expect(await decrypt(encoded, keys)).toBe('session-token-123');
  });

  it('never contains the plaintext and uses a fresh IV each time', async () => {
    const keys = fixedKey();
    const a = await encrypt('session-token-123', keys);
    const b = await encrypt('session-token-123', keys);
    expect(a).not.toContain('session-token-123');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1:')).toBe(true);
  });

  it('fails with the wrong key', async () => {
    const encoded = await encrypt('secret', fixedKey());
    await expect(decrypt(encoded, fixedKey())).rejects.toThrow();
  });

  it('fails when the ciphertext was tampered with', async () => {
    const keys = fixedKey();
    const [format, iv, tag, ct] = (await encrypt('secret', keys)).split(':');
    const flipped = Buffer.from(ct!, 'base64');
    flipped[0]! ^= 1;
    await expect(
      decrypt([format, iv, tag, flipped.toString('base64')].join(':'), keys),
    ).rejects.toThrow();
  });

  it('rejects values that are not in the v1 format', async () => {
    await expect(decrypt('plaintext-token', fixedKey())).rejects.toThrow(
      'unrecognized encrypted value format',
    );
    await expect(decrypt('v2:a:b:c', fixedKey())).rejects.toThrow(
      'unrecognized encrypted value format',
    );
  });
});

describe('FileKeyProvider', () => {
  it('creates a 0600 key file once, warns once, and reuses it', async () => {
    const path = join(await tempDir(), 'nested', 'key');
    const warn = vi.fn();
    const first = await new FileKeyProvider(path, warn).getKey();
    const second = await new FileKeyProvider(path, warn).getKey();

    expect(first).toHaveLength(32);
    expect(second.equals(first)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('weaker');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(Buffer.from(await readFile(path, 'utf8'), 'base64').equals(first)).toBe(true);
  });

  it('rejects a malformed key file instead of using it', async () => {
    const path = join(await tempDir(), 'key');
    await writeFile(path, 'not-a-key');
    await expect(new FileKeyProvider(path, () => {}).getKey()).rejects.toThrow('malformed');
  });
});

describe('DefaultKeyProvider', () => {
  it('uses the keychain when it works', async () => {
    const key = randomBytes(32);
    const file = { getKey: vi.fn() };
    expect((await new DefaultKeyProvider(fixedKey(key), file).getKey()).equals(key)).toBe(true);
    expect(file.getKey).not.toHaveBeenCalled();
  });

  it('falls back to the key file when the keychain is unavailable', async () => {
    const key = randomBytes(32);
    const keychain = { getKey: () => Promise.reject(new Error('no secret service')) };
    expect((await new DefaultKeyProvider(keychain, fixedKey(key)).getKey()).equals(key)).toBe(true);
  });

  it('asks the keychain only once per process', async () => {
    const keychain = { getKey: vi.fn(async () => randomBytes(32)) };
    const provider = new DefaultKeyProvider(keychain, fixedKey());
    const [a, b] = await Promise.all([provider.getKey(), provider.getKey()]);
    expect(a.equals(b)).toBe(true);
    expect(keychain.getKey).toHaveBeenCalledTimes(1);
  });
});
