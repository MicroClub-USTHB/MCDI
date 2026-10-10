const AUTH_COOKIE_NAME = 'auth-token';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secureAttribute(): string {
  // `Secure` is valid on http://localhost (browsers treat it as a secure
  // context) but must be conditional for any other plain-HTTP host, or the
  // cookie silently fails to set.
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

/**
 * The real session is the backend's `admin_session` httpOnly cookie, set on
 * the API's origin and unreadable from JS. This cookie is a same-origin flag
 * that only signals "a validated session exists" so `proxy.ts` — which
 * runs server-side and can't read localStorage — can redirect unauthenticated
 * requests without a round trip to the API. It is set only after
 * `/auth/admin/me` returns 200, never from unvalidated input.
 */
export function setAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secureAttribute()}`;
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secureAttribute()}`;
}
