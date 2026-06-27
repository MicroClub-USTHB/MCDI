import {
  buildSsoClearCookieOptions,
  buildSsoCookieOptions,
} from './sso-cookie.util';

describe('sso-cookie.util', () => {
  describe('buildSsoCookieOptions', () => {
    it('locks down the cookie in production (httpOnly + secure + lax + maxAge)', () => {
      const options = buildSsoCookieOptions({
        name: 'mcdi_sso',
        ttlSec: 60,
        isProduction: true,
        domain: '.microclub.dz',
      });

      expect(options).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        domain: '.microclub.dz',
        path: '/',
        maxAge: 60_000,
      });
    });

    it('keeps secure=false in development so the cookie ships over http://localhost', () => {
      const options = buildSsoCookieOptions({
        name: 'mcdi_sso',
        ttlSec: 30,
        isProduction: false,
      });

      expect(options.secure).toBe(false);
      expect(options.domain).toBeUndefined();
    });

    it('multiplies ttlSec by 1000 for maxAge (cookie API expects ms)', () => {
      const options = buildSsoCookieOptions({
        name: 'mcdi_sso',
        ttlSec: 2_592_000,
        isProduction: true,
      });
      expect(options.maxAge).toBe(2_592_000_000);
    });
  });

  describe('buildSsoClearCookieOptions', () => {
    it('mirrors the cookie domain/path so the browser actually clears it', () => {
      expect(buildSsoClearCookieOptions({ domain: '.microclub.dz' })).toEqual({
        domain: '.microclub.dz',
        path: '/',
      });
    });

    it('omits the domain when one was not configured', () => {
      expect(buildSsoClearCookieOptions({})).toEqual({
        domain: undefined,
        path: '/',
      });
    });
  });
});
