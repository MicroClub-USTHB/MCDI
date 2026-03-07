import { buildErrorRedirect } from './build-error-redirect';

describe('buildErrorRedirect', () => {
  const BASE_URI = 'https://platform.example.com/auth/callback';

  it('returns an object with a url property', () => {
    const result = buildErrorRedirect(BASE_URI, 'access_denied', 'User denied');
    expect(result).toHaveProperty('url');
    expect(typeof result.url).toBe('string');
  });

  it('returns a valid URL', () => {
    const result = buildErrorRedirect(BASE_URI, 'access_denied', 'User denied');
    expect(() => new URL(result.url)).not.toThrow();
  });

  it('preserves the base redirect URI origin and path', () => {
    const result = buildErrorRedirect(BASE_URI, 'access_denied', 'User denied');
    const parsed = new URL(result.url);
    expect(parsed.origin + parsed.pathname).toBe(BASE_URI);
  });

  it('sets the error query parameter', () => {
    const result = buildErrorRedirect(BASE_URI, 'access_denied', 'User denied');
    const params = new URL(result.url).searchParams;
    expect(params.get('error')).toBe('access_denied');
  });

  it('sets the error_description query parameter', () => {
    const result = buildErrorRedirect(
      BASE_URI,
      'access_denied',
      'User denied access',
    );
    const params = new URL(result.url).searchParams;
    expect(params.get('error_description')).toBe('User denied access');
  });

  it('URL-encodes special characters in error_description', () => {
    const description = 'Server not found: "Main Server" (id=123)';
    const result = buildErrorRedirect(BASE_URI, 'server_error', description);
    const params = new URL(result.url).searchParams;
    expect(params.get('error_description')).toBe(description);
  });

  it('preserves existing query parameters on the base URI', () => {
    const uriWithParams = 'https://platform.example.com/callback?session=abc';
    const result = buildErrorRedirect(
      uriWithParams,
      'invalid_request',
      'Bad key',
    );
    const params = new URL(result.url).searchParams;
    expect(params.get('session')).toBe('abc');
    expect(params.get('error')).toBe('invalid_request');
    expect(params.get('error_description')).toBe('Bad key');
  });

  it('handles different error codes', () => {
    const codes = [
      'access_denied',
      'invalid_request',
      'server_error',
      'unauthorized_client',
    ];
    for (const code of codes) {
      const result = buildErrorRedirect(BASE_URI, code, 'desc');
      expect(new URL(result.url).searchParams.get('error')).toBe(code);
    }
  });
});
