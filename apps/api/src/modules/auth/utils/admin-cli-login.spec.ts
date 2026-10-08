import {
  buildCliRedirect,
  codeChallengeFor,
  isValidCodeChallenge,
  isValidCodeVerifier,
  parseLoopbackRedirectUri,
  verifyCodeChallenge,
} from './admin-cli-login';

describe('admin CLI login helpers', () => {
  describe('parseLoopbackRedirectUri', () => {
    it.each([
      'http://127.0.0.1:53123/callback',
      'http://localhost:8080/callback',
      'http://[::1]:9000/cb',
      'http://127.0.0.1:1/',
    ])('accepts the loopback URL %s', (uri) => {
      expect(parseLoopbackRedirectUri(uri)).toBe(new URL(uri).toString());
    });

    it.each([
      ['not a URL', 'nope'],
      ['https', 'https://127.0.0.1:53123/callback'],
      ['another host', 'http://evil.example:53123/callback'],
      ['a lookalike host', 'http://127.0.0.1.evil.example:53123/callback'],
      ['a LAN address', 'http://192.168.1.10:53123/callback'],
      ['no explicit port', 'http://127.0.0.1/callback'],
      ['credentials', 'http://user:pass@127.0.0.1:53123/callback'],
      ['a fragment', 'http://127.0.0.1:53123/callback#x'],
      ['javascript:', 'javascript:alert(1)'],
    ])('rejects %s', (_name, uri) => {
      expect(parseLoopbackRedirectUri(uri)).toBeNull();
    });
  });

  describe('PKCE', () => {
    // RFC 7636 Appendix B test vector.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    it('computes the S256 challenge from RFC 7636 Appendix B', () => {
      expect(codeChallengeFor(verifier)).toBe(challenge);
    });

    it('verifies a matching verifier and rejects anything else', () => {
      expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
      expect(verifyCodeChallenge(`${verifier.slice(0, -1)}A`, challenge)).toBe(
        false,
      );
      expect(verifyCodeChallenge(verifier, `${challenge.slice(0, -1)}A`)).toBe(
        false,
      );
      expect(verifyCodeChallenge('short', codeChallengeFor('short'))).toBe(
        false,
      );
      expect(verifyCodeChallenge(verifier, 'not-the-right-length')).toBe(false);
    });

    it('checks challenge and verifier formats', () => {
      expect(isValidCodeChallenge(challenge)).toBe(true);
      expect(isValidCodeChallenge('too-short')).toBe(false);
      expect(isValidCodeChallenge(`${challenge}=`)).toBe(false);
      expect(isValidCodeVerifier(verifier)).toBe(true);
      expect(isValidCodeVerifier('a'.repeat(42))).toBe(false);
      expect(isValidCodeVerifier('a'.repeat(129))).toBe(false);
      expect(isValidCodeVerifier(`${'a'.repeat(42)} `)).toBe(false);
    });
  });

  describe('buildCliRedirect', () => {
    it('adds the parameters to the loopback URL', () => {
      const url = new URL(
        buildCliRedirect('http://127.0.0.1:5000/callback', {
          code: 'abc',
          state: 's t',
        }),
      );
      expect(url.origin + url.pathname).toBe('http://127.0.0.1:5000/callback');
      expect(url.searchParams.get('code')).toBe('abc');
      expect(url.searchParams.get('state')).toBe('s t');
    });
  });
});
