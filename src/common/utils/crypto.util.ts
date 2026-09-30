import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * AES-256-GCM encryption for secrets that must be recoverable.
 *
 * Contrast with api-key.util.ts, which stores only sha256(secret): that works
 * because verification compares hashes. HMAC verification is different — the
 * server must recompute HMAC(secret, body), which needs the raw secret back.
 * Hence encryption, not hashing.
 *
 * Wire format: base64( iv[12] || authTag[16] || ciphertext )
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ENV_KEY = 'WEBHOOK_ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;

/**
 * Resolves the encryption key, throwing if it is absent or the wrong size.
 * Callers at boot should let this throw — silently falling back to plaintext
 * secrets is exactly the failure that ships unnoticed.
 */
export function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new Error(
      `${ENV_KEY} is not set. Generate one with: openssl rand -base64 32`,
    );
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `${ENV_KEY} must decode to exactly ${KEY_LENGTH} bytes (got ${key.length}). ` +
        'Generate one with: openssl rand -base64 32',
    );
  }

  cachedKey = key;
  return key;
}

/** Test seam — clears the memoised key so a changed env var takes effect. */
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
}

export function encryptSecret(
  plaintext: string,
  key = getEncryptionKey(),
): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    'base64',
  );
}

export function decryptSecret(
  encoded: string,
  key = getEncryptionKey(),
): string {
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('Ciphertext is malformed');
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/** Constant-time comparison of two hex strings of equal expected length. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
