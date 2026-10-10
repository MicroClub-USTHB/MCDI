import { createHash, randomBytes } from 'node:crypto';

/**
 * PKCE (RFC 7636) for the admin login: the CLI keeps `verifier` to itself and
 * sends only `challenge` to MCDI, so a login code intercepted on the loopback
 * redirect is useless without it.
 */
export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** S256: BASE64URL(SHA256(ASCII(verifier))). */
export function codeChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** A fresh 43-character verifier (32 random bytes) and its S256 challenge. */
export function createPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: codeChallengeFor(verifier) };
}
