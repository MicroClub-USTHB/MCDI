/**
 * Build a redirect URL that carries error information back to the platform.
 */
export function buildErrorRedirect(
  redirectUri: string,
  error: string,
  description: string,
): { url: string } {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  return { url: url.toString() };
}
