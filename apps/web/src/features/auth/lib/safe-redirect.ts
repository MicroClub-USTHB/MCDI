const DEFAULT_REDIRECT = '/dashboard';

/**
 * The `redirect` query param travels an untrusted round trip: a link an
 * admin clicks (`/login?redirect=...`) → the backend's OAuth redirect →
 * back to `/callback?redirect=...` → `router.replace(redirect)`. Without
 * validation, a crafted link (`?redirect=https://evil.com` or
 * `//evil.com`) could send a freshly authenticated admin straight to an
 * attacker-controlled page the moment login succeeds. Only same-origin
 * relative paths are allowed through; everything else falls back to the
 * dashboard.
 */
export function getSafeRedirectPath(
  target: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!target) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}
