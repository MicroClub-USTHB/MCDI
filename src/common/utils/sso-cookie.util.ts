import type { CookieOptions } from 'express';

export interface SsoCookieConfig {
  name: string;
  domain?: string;
  ttlSec: number;
  isProduction: boolean;
}

/**
 * Options for the `mcdi_sso` httpOnly cookie.
 *
 * - `httpOnly` keeps the token unreadable to JavaScript.
 * - `sameSite=lax` permits top-level navigation (the SSO authorize flow)
 *   while blocking cross-site form posts.
 * - `secure` is forced in production; in dev we leave it off so the
 *   cookie is sent over `http://localhost`.
 * - `domain` is opt-in via `SSO_COOKIE_DOMAIN` (e.g. `.microclub.dz`) so
 *   the cookie spans every project subdomain.
 */
export function buildSsoCookieOptions(config: SsoCookieConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    domain: config.domain,
    path: '/',
    maxAge: config.ttlSec * 1000,
  };
}

/** Matching options for clearing the cookie — domain/path must agree. */
export function buildSsoClearCookieOptions(
  config: Pick<SsoCookieConfig, 'domain'>,
): CookieOptions {
  return {
    domain: config.domain,
    path: '/',
  };
}
