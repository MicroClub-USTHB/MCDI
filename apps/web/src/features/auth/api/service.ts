import { apiClient } from '@/shared/lib/api-client';
import { env } from '@/shared/lib/env';
import type { ApiResponse } from '@/shared/types';
import type { AdminProfileDto } from '@/features/auth/types';
import { getSafeRedirectPath } from '@/features/auth/lib/safe-redirect';

const REDIRECT_STORAGE_KEY = 'mcdi.auth.post-login-redirect';

/**
 * The URL that kicks off the Discord OAuth handshake. This is a full page
 * navigation (302 chain through the backend and Discord), never an
 * `apiClient` call — the backend owns the redirect back to `/callback`, and
 * only a top-level navigation sends the `Accept: text/html` that makes
 * `GET /auth/admin/discord` redirect instead of returning JSON.
 */
export function getDiscordOAuthUrl(): string {
  return `${env.NEXT_PUBLIC_API_URL}/auth/admin/discord`;
}

/**
 * Stash where to land after login.
 *
 * The backend generates its own OAuth `state` and redirects to a fixed
 * `ADMIN_FRONTEND_URL` — it accepts no `redirect` parameter and echoes
 * nothing back, so the intended destination cannot survive the round trip
 * through Discord on the URL. `sessionStorage` is per-origin and per-tab, and
 * the OAuth bounce returns to this same origin and tab, so the value is still
 * here when `/callback` runs.
 */
export function rememberPostLoginRedirect(path?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(REDIRECT_STORAGE_KEY, getSafeRedirectPath(path));
  } catch {
    // Private-mode / quota failures are not worth breaking login over; the
    // callback falls back to the default redirect.
  }
}

/**
 * Reads and clears the stashed redirect. Re-validated on the way out rather
 * than trusted from storage — another script on this origin could have
 * written an off-site URL into that key.
 */
export function consumePostLoginRedirect(): string {
  if (typeof window === 'undefined') return getSafeRedirectPath(null);
  try {
    const stored = window.sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    window.sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
    return getSafeRedirectPath(stored);
  } catch {
    return getSafeRedirectPath(null);
  }
}

export function fetchCurrentAdmin(): Promise<ApiResponse<AdminProfileDto>> {
  return apiClient.get<AdminProfileDto>('/auth/admin/me');
}

/**
 * Ends the session on the server: revokes the session row and clears the
 * `admin_session` cookie. Takes no body — the backend reads the token from
 * the cookie the browser sends with the request, which is why this has to go
 * through `apiClient` (it sets `credentials: 'include'`) rather than a bare
 * `fetch`.
 */
export function logoutAdmin(): Promise<ApiResponse<{ success: boolean }>> {
  return apiClient.post<{ success: boolean }>('/auth/admin/logout');
}
