import { createHash } from 'crypto';

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionTokenCandidates(token: string): string[] {
  return [token, hashSessionToken(token)];
}
