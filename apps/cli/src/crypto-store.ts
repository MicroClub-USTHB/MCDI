import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { configDir } from './config.js';

/**
 * Encrypts secrets (session tokens and webhook signing secrets) at rest with
 * AES-256-GCM (PRD §12.1). The key lives in the OS keychain when one is
 * reachable, otherwise in a 0600 key file.
 *
 * Every encrypted value records which of the two keys encrypted it, and is
 * only ever decrypted with that key. A run where the keychain happens to be
 * unreachable (a locked keychain, an SSH session) therefore never produces a
 * value the next run cannot read: MCDI never re-issues a signing secret, so a
 * value encrypted with the wrong key would be lost for good.
 */

const KEYCHAIN_SERVICE = 'mcdi-cli';
const KEYCHAIN_ACCOUNT = 'encryption-key';
const KEY_FILE_NAME = 'key';
const FORMAT = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type KeySource = 'keychain' | 'file';

/** How a key source is written inside an encrypted value. */
const SOURCE_TAG: Record<KeySource, string> = { keychain: 'kc', file: 'file' };

/** One place a key can live. */
export interface KeyStore {
  /** Returns the 32-byte key, creating and persisting one on first use. */
  getKey(): Promise<Buffer>;
}

/** Picks the key to encrypt with, and returns the exact key a stored value names. */
export interface KeyProvider {
  keyForWrite(): Promise<{ source: KeySource; key: Buffer }>;
  keyFor(source: KeySource): Promise<Buffer>;
}

/** Stores the key in the OS keychain (macOS Keychain, Secret Service, Windows Credential Manager). */
class KeychainKeyStore implements KeyStore {
  constructor(private readonly service = KEYCHAIN_SERVICE) {}

  async getKey(): Promise<Buffer> {
    const { Entry } = await import('@napi-rs/keyring');
    // On Linux, never fall back to the kernel keyring: it lives in memory and
    // is gone after a reboot, which would take the key with it.
    const entry = new Entry(this.service, KEYCHAIN_ACCOUNT, {
      linux: { store: 'secret-service' },
    });
    const existing = entry.getPassword();
    if (existing) return decodeKey(existing, 'the OS keychain');
    entry.setPassword(randomBytes(32).toString('base64'));
    // Read back what is stored: if another process created a key at the same
    // time, both must use the one that won.
    return decodeKey(entry.getPassword() ?? '', 'the OS keychain');
  }
}

/** Weaker fallback: a locally generated key file with mode 0600. */
export class FileKeyStore implements KeyStore {
  constructor(private readonly path: string) {}

  async getKey(): Promise<Buffer> {
    const existing = await this.read();
    if (existing) return existing;
    const key = randomBytes(32);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    try {
      // 'wx' fails rather than overwrite a key another process created meanwhile.
      await writeFile(this.path, key.toString('base64'), { mode: 0o600, flag: 'wx' });
      return key;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      // Another process won the race: use its key, not ours.
      return (await this.read())!;
    }
  }

  private async read(): Promise<Buffer | undefined> {
    try {
      return decodeKey(await readFile(this.path, 'utf8'), this.path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw err;
    }
  }
}

/**
 * Encrypts with the keychain key, and with the key file only while the
 * keychain is unreachable, warning once per run when it does. Decrypts with exactly
 * the key a value names, so a keychain failure on read is an error to fix
 * (unlock the keychain), never a silent switch to another key.
 */
export class FallbackKeyProvider implements KeyProvider {
  private readonly keys = new Map<KeySource, Promise<Buffer>>();
  private warned = false;

  constructor(
    private readonly keychain: KeyStore,
    private readonly file: KeyStore,
    private readonly keyFilePath: string,
    private readonly warn: (message: string) => void = (m) => process.stderr.write(`${m}\n`),
  ) {}

  async keyForWrite(): Promise<{ source: KeySource; key: Buffer }> {
    try {
      return { source: 'keychain', key: await this.keyFor('keychain') };
    } catch (err) {
      if (!this.warned) {
        this.warned = true;
        this.warn(
          `warning: the OS keychain is unavailable (${errorMessage(err)}), so secrets are encrypted ` +
            `with the key in ${this.keyFilePath}. That is weaker than keychain storage: anyone who can ` +
            'read that file can decrypt them.',
        );
      }
      return { source: 'file', key: await this.keyFor('file') };
    }
  }

  keyFor(source: KeySource): Promise<Buffer> {
    let key = this.keys.get(source);
    if (!key) {
      key = (source === 'keychain' ? this.keychain : this.file).getKey();
      // A failed attempt is not cached, so a later call can retry.
      key.catch(() => this.keys.delete(source));
      this.keys.set(source, key);
    }
    return key;
  }
}

/** The keychain, with a key file next to the config file as the fallback. */
export function defaultKeyProvider(): KeyProvider {
  const keyFilePath = join(configDir(), KEY_FILE_NAME);
  return new FallbackKeyProvider(
    new KeychainKeyStore(),
    new FileKeyStore(keyFilePath),
    keyFilePath,
  );
}

/** The key a stored value needs could not be read, as opposed to the value being corrupt. */
export class KeyUnavailableError extends Error {
  constructor(
    readonly source: KeySource,
    cause: unknown,
  ) {
    super(
      source === 'keychain'
        ? `the OS keychain could not be read (${errorMessage(cause)}); unlock it and try again`
        : `the key file could not be read (${errorMessage(cause)})`,
    );
    this.name = 'KeyUnavailableError';
  }
}

function decodeKey(encoded: string, location: string): Buffer {
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.length !== 32) throw new Error(`the encryption key in ${location} is malformed`);
  return key;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * `context` names the slot the value is stored in (for example
 * `prod/session`). It is authenticated but not stored, so a value copied into
 * another slot of the config file fails to decrypt instead of being revealed
 * as something else.
 */
export async function encrypt(
  plaintext: string,
  keys: KeyProvider,
  context: string,
): Promise<string> {
  const { source, key } = await keys.keyForWrite();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    FORMAT,
    SOURCE_TAG[source],
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export async function decrypt(
  encoded: string,
  keys: KeyProvider,
  context: string,
): Promise<string> {
  const [format, sourceTag, iv, tag, ciphertext, ...rest] = encoded.split(':');
  const source = (Object.keys(SOURCE_TAG) as KeySource[]).find((s) => SOURCE_TAG[s] === sourceTag);
  if (format !== FORMAT || !source || !iv || !tag || ciphertext === undefined || rest.length > 0) {
    throw new Error('unrecognized encrypted value format');
  }
  const authTag = Buffer.from(tag, 'base64');
  if (authTag.length !== AUTH_TAG_BYTES) throw new Error('unrecognized encrypted value format');

  let key: Buffer;
  try {
    key = await keys.keyFor(source);
  } catch (err) {
    throw new KeyUnavailableError(source, err);
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'), {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** The slot a profile's session token is stored in. */
export const sessionContext = (profile: string): string => `${profile}/session`;

/** The slot a webhook's signing secret is stored in. */
export const webhookSecretContext = (profile: string, webhookId: string): string =>
  `${profile}/webhook/${webhookId}`;
