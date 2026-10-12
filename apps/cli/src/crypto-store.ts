import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Encrypts secrets (session tokens, later webhook signing secrets) at rest
 * with AES-256-GCM (PRD §12.1). The key lives in the OS keychain when one is
 * reachable, otherwise in a 0600 key file.
 */

const KEYCHAIN_SERVICE = 'mcdi-cli';
const KEYCHAIN_ACCOUNT = 'encryption-key';
const FORMAT = 'v1';

export interface KeyProvider {
  /** Returns the 32-byte key, creating and persisting one on first use. */
  getKey(): Promise<Buffer>;
}

/** Stores the key in the OS keychain (macOS Keychain, libsecret, Windows Credential Manager). */
export class KeychainKeyProvider implements KeyProvider {
  constructor(private readonly service = KEYCHAIN_SERVICE) {}

  async getKey(): Promise<Buffer> {
    const { Entry } = await import('@napi-rs/keyring');
    const entry = new Entry(this.service, KEYCHAIN_ACCOUNT);
    const existing = entry.getPassword();
    if (existing) return decodeKey(existing, 'OS keychain');
    const key = randomBytes(32);
    entry.setPassword(key.toString('base64'));
    return key;
  }
}

/** Weaker fallback: a locally generated key file with mode 0600. */
export class FileKeyProvider implements KeyProvider {
  constructor(
    private readonly path: string,
    private readonly warn: (message: string) => void = (m) => process.stderr.write(`${m}\n`),
  ) {}

  async getKey(): Promise<Buffer> {
    try {
      return decodeKey(await readFile(this.path, 'utf8'), this.path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const key = randomBytes(32);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    // 'wx' fails rather than overwrite a key another process created meanwhile.
    await writeFile(this.path, key.toString('base64'), { mode: 0o600, flag: 'wx' });
    this.warn(
      `warning: no OS keychain available, so the encryption key is stored in ${this.path}. ` +
        'This is weaker than keychain storage: anyone who can read that file can decrypt your session.',
    );
    return key;
  }
}

/** Uses the keychain, falling back to the key file only if the keychain is unavailable. */
export class DefaultKeyProvider implements KeyProvider {
  private key: Promise<Buffer> | undefined;

  constructor(
    private readonly keychain: KeyProvider,
    private readonly file: KeyProvider,
  ) {}

  getKey(): Promise<Buffer> {
    this.key ??= this.keychain.getKey().catch(() => this.file.getKey());
    return this.key;
  }
}

/** Keychain first, falling back to a local key file only when the keychain is unavailable. */
export function defaultKeyProvider(keyFilePath: string): KeyProvider {
  return new DefaultKeyProvider(new KeychainKeyProvider(), new FileKeyProvider(keyFilePath));
}

function decodeKey(encoded: string, source: string): Buffer {
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.length !== 32) throw new Error(`encryption key in ${source} is malformed`);
  return key;
}

export async function encrypt(plaintext: string, keys: KeyProvider): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await keys.getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    FORMAT,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export async function decrypt(encoded: string, keys: KeyProvider): Promise<string> {
  const [format, iv, tag, ciphertext, ...rest] = encoded.split(':');
  if (format !== FORMAT || !iv || !tag || ciphertext === undefined || rest.length > 0) {
    throw new Error('unrecognized encrypted value format');
  }
  const decipher = createDecipheriv('aes-256-gcm', await keys.getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
