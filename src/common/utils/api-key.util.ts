import { randomBytes, createHash, timingSafeEqual } from 'crypto';

export function generateApiKey(): {
  fullKey: string;
  prefix: string;
  hash: string;
} {
  const prefixId = randomBytes(4).toString('hex');
  const secret = randomBytes(32).toString('hex');
  const prefix = `pk_${prefixId}`;
  const fullKey = `${prefix}.${secret}`;
  const hash = createHash('sha256').update(secret).digest('hex');
  return { fullKey, prefix, hash };
}
export function verifyApiKey(secret: string, storedHash: string): boolean {
  const hash = createHash('sha256').update(secret).digest('hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedHashBuffer = Buffer.from(storedHash, 'hex');

  if (hashBuffer.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(hashBuffer, storedHashBuffer);
}
