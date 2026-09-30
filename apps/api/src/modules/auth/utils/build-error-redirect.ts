/**
 * Build a redirect URL that carries error information back to the platform.
 * When state is provided it is passed through so the client can correlate
 * the error with the original authorization request (CSRF / session match).
 */
export function buildErrorRedirect(
  redirectUri: string,
  error: string,
  description: string,
  state?: string | null,
): { url: string } {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) {
    url.searchParams.set('state', state);
  }
  return { url: url.toString() };
}
