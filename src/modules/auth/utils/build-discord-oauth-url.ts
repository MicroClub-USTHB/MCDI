/**
 * Build the full Discord OAuth2 authorization URL with query parameters.
 */
export function buildDiscordOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL('https://discord.com/api/oauth2/authorize');
  const params = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email guilds guilds.members.read',
    state,
  };
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  return url.toString();
}
