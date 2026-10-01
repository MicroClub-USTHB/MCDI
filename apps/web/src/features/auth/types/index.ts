/**
 * Raw shape returned by `GET /auth/admin/me`. Mirrors the backend's
 * `AdminAuthService.getMe` return value — `globalName`, `displayName`,
 * `avatar` and `email` are all nullable columns on the member record. Kept
 * separate from the shared `User` type so backend field-naming changes only
 * touch `mappers.ts`.
 */
export interface AdminProfileDto {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  email: string | null;
  isSystemAdmin: boolean;
  /** Serialized `Date` — an ISO 8601 string over the wire. */
  sessionExpiresAt: string;
}

/**
 * Query params on the backend's redirect to `/callback`.
 *
 * On success there are none — the session rides in the `admin_session`
 * httpOnly cookie the backend set on the same response, so `/callback`
 * confirms it by calling `/auth/admin/me` rather than by reading the URL.
 * Only failures carry anything, and `error` is the raw exception message.
 */
export interface AuthCallbackParams {
  error: string | null;
}
