export function buildCallbackCodeRedirect(
  redirectUri: string,
  callbackCode: string,
  state?: string | null,
): { url: string } {
  const url = new URL(redirectUri);
  url.searchParams.set('code', callbackCode);
  if (state) {
    url.searchParams.set('state', state);
  }
  return { url: url.toString() };
}