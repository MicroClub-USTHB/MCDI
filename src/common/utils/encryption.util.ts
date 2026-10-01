import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/i;

function resolveKey(keyHex: string): Buffer {
  if (!KEY_HEX_PATTERN.test(keyHex)) {
    throw new Error(
      'encryption key must be 64 hex characters (openssl rand -hex 32)',
    );
  }
  return Buffer.from(keyHex, 'hex');
}

// Payload format is "<iv>.<auth tag>.<ciphertext>", each part base64.
// There is no key rotation. Re-encrypting under a new key means recreating
// the stored secrets.
export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = resolveKey(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptSecret(payload: string, keyHex: string): string {
  const key = resolveKey(keyHex);
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('encrypted payload must be "<iv>.<tag>.<ciphertext>"');
  }
  const [iv, tag, ciphertext] = parts.map((part) =>
    Buffer.from(part, 'base64'),
  );
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
