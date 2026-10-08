import { createHash, timingSafeEqual } from 'crypto';

/**
 * Helpers for the admin CLI login (m-forge): a native app receives the result
 * on a loopback redirect (RFC 8252) and proves it started the login with PKCE
 * S256 (RFC 7636).
 */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** RFC 7636 §4.2: BASE64URL(SHA256(verifier)) is always 43 characters. */
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** RFC 7636 §4.1: 43-128 characters from the unreserved set. */
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

/**
 * Accepts only an `http://` loopback URL with an explicit port, so a login can
 * never be handed to another host (no open redirect). Returns the normalized
 * URL, or null when the value isn't an acceptable CLI redirect.
 */
export function parseLoopbackRedirectUri(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:') return null;
  if (!LOOPBACK_HOSTS.has(url.hostname)) return null;
  if (!url.port) return null;
  if (url.username || url.password || url.hash) return null;
  return url.toString();
}

export function isValidCodeChallenge(value: string): boolean {
  return CODE_CHALLENGE_PATTERN.test(value);
}

export function isValidCodeVerifier(value: string): boolean {
  return CODE_VERIFIER_PATTERN.test(value);
}

/** PKCE S256 transform: BASE64URL(SHA256(ASCII(verifier))). */
export function codeChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** Constant-time check that `verifier` hashes to the stored `challenge`. */
export function verifyCodeChallenge(
  verifier: string,
  challenge: string,
): boolean {
  if (!isValidCodeVerifier(verifier)) return false;
  const expected = Buffer.from(codeChallengeFor(verifier));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Appends query parameters to the CLI's loopback URL. */
export function buildCliRedirect(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
