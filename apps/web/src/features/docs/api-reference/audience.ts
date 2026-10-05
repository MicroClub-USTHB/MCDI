import type { Operation } from '@/features/docs/api-reference/types';

/** Who calls an endpoint: another project's code, or the admin dashboard. */
export type Audience = 'project' | 'admin';

const AUTH_PREFIX = '/api/auth';
/** Under `/api/auth`: the admin login, profile and logout, and a maintenance job. */
const ADMIN_AUTH_PREFIXES = ['/api/auth/admin', '/api/auth/cleanup'];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Which API an operation belongs to.
 *
 * Under `/api/auth` the path decides, because there the `session-token` scheme means two things:
 * the endpoints for a member's own session (listing and revoking sessions, refreshing a token,
 * which a project's app calls) and the admin ones. Only `/api/auth/admin/*` and the cleanup job
 * are the dashboard's; everything else there (the login flow, the code exchange, the sessions)
 * is the project API.
 *
 * Everywhere else the scheme decides: a project API key means the **project API** (also when an
 * admin session is accepted too, because a project can call it), an admin session means the
 * **admin API**, and a public endpoint is the **project API**.
 */
export function audienceOf(path: string, operation: Operation): Audience {
  if (under(path, AUTH_PREFIX)) {
    return ADMIN_AUTH_PREFIXES.some((prefix) => under(path, prefix)) ? 'admin' : 'project';
  }
  const schemes = (operation.security ?? []).flatMap((requirement) => Object.keys(requirement));
  if (schemes.includes('api-key')) return 'project';
  if (schemes.includes('session-token')) return 'admin';
  return 'project';
}
