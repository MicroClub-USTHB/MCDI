import { buildDiscordOAuthUrl } from './build-discord-oauth-url';

describe('buildDiscordOAuthUrl', () => {
  const CLIENT_ID = 'my-client-id';
  const REDIRECT_URI = 'https://mcdi.example.com/auth/discord/callback';
  const STATE = 'random-state-token';

  function parse(url: string) {
    const parsed = new URL(url);
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      params: Object.fromEntries(parsed.searchParams.entries()),
    };
  }

  it('targets the Discord OAuth2 authorization endpoint', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    const { origin, pathname } = parse(url);
    expect(origin).toBe('https://discord.com');
    expect(pathname).toBe('/api/oauth2/authorize');
  });

  it('includes client_id from argument', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    expect(parse(url).params.client_id).toBe(CLIENT_ID);
  });

  it('includes redirect_uri from argument', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    expect(parse(url).params.redirect_uri).toBe(REDIRECT_URI);
  });

  it('sets response_type to code', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    expect(parse(url).params.response_type).toBe('code');
  });

  it('includes the required OAuth scopes', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    const scope = parse(url).params.scope;
    expect(scope).toContain('identify');
    expect(scope).toContain('email');
    expect(scope).toContain('guilds');
    expect(scope).toContain('guilds.members.read');
  });

  it('embeds the state parameter', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    expect(parse(url).params.state).toBe(STATE);
  });

  it('returns a valid URL string', () => {
    const url = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, STATE);
    expect(() => new URL(url)).not.toThrow();
  });

  it('URL-encodes the redirect_uri correctly', () => {
    const complexUri =
      'https://platform.example.com/auth/callback?foo=bar&baz=qux';
    const url = buildDiscordOAuthUrl(CLIENT_ID, complexUri, STATE);
    expect(parse(url).params.redirect_uri).toBe(complexUri);
  });

  it('preserves different state values per call', () => {
    const url1 = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, 'state-a');
    const url2 = buildDiscordOAuthUrl(CLIENT_ID, REDIRECT_URI, 'state-b');
    expect(parse(url1).params.state).toBe('state-a');
    expect(parse(url2).params.state).toBe('state-b');
  });
});
