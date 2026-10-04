import { CliError, ExitCode } from './errors.js';

/**
 * Thin client for the MCDI admin auth endpoints (docs/endpoints/login/).
 * `baseUrl` is the MCDI origin without the `/api` prefix, as stored in profiles.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export interface AdminMe {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  preferredName: string | null;
  sessionExpiresAt: string;
}

async function request(baseUrl: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${baseUrl}/api${path}`;
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(`could not reach MCDI at ${baseUrl} (${reason})`, ExitCode.Unexpected);
  }
}

async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new CliError(`MCDI returned a non-JSON response for ${what} (HTTP ${res.status})`, ExitCode.Unexpected);
  }
}

/**
 * GET /auth/admin/discord → the Discord consent URL.
 * `redirectUri` is the CLI's loopback callback; MCDI ignores it until issue #2 lands.
 */
export async function getAdminLoginUrl(baseUrl: string, redirectUri: string): Promise<string> {
  const query = new URLSearchParams({ redirect_uri: redirectUri });
  const res = await request(baseUrl, `/auth/admin/discord?${query}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new CliError(`MCDI refused to start the login (HTTP ${res.status})`, ExitCode.Unexpected);
  }
  const body = (await readJson(res, 'the login URL')) as { url?: unknown } | null;
  if (typeof body?.url !== 'string') {
    throw new CliError('MCDI login response is missing the Discord URL', ExitCode.Unexpected);
  }
  return body.url;
}

/** GET /auth/admin/me → the admin behind a session token. */
export async function getAdminMe(baseUrl: string, token: string): Promise<AdminMe> {
  const res = await request(baseUrl, '/auth/admin/me', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new CliError('MCDI rejected the session token (invalid or expired)', ExitCode.Auth);
  }
  if (res.status === 403) {
    throw new CliError('this Discord account is not a system admin on this MCDI instance', ExitCode.Auth);
  }
  if (!res.ok) {
    throw new CliError(`MCDI returned HTTP ${res.status} for the admin profile`, ExitCode.Unexpected);
  }
  const me = (await readJson(res, 'the admin profile')) as Partial<AdminMe> | null;
  if (typeof me?.id !== 'string' || typeof me.username !== 'string' || typeof me.sessionExpiresAt !== 'string') {
    throw new CliError('MCDI admin profile response has an unexpected shape', ExitCode.Unexpected);
  }
  return me as AdminMe;
}

export function adminDisplayName(me: AdminMe): string {
  return me.preferredName || me.displayName || me.globalName || me.username;
}
