import { createHash, randomBytes } from 'crypto';

export function generateSsoToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashSsoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
