import { describe, expect, it } from 'vitest';
import { CliError, ExitCode } from './errors.js';
import {
  adminLoginQuery,
  exchangeAdminLoginCode,
  parseAdminLoginSession,
  parseRotatedSecret,
} from './mcid.js';

describe('parseRotatedSecret', () => {
  it('returns the signing secret from a well-shaped response', () => {
    expect(parseRotatedSecret({ signingSecret: 'whsec_abc123' })).toBe('whsec_abc123');
  });

  it('rejects a response missing signingSecret, or where it is not a string', () => {
    for (const body of [null, undefined, {}, { signingSecret: 123 }, { signingSecret: null }]) {
      expect(() => parseRotatedSecret(body)).toThrow(CliError);
      try {
        parseRotatedSecret(body);
        expect.unreachable();
      } catch (err) {
        expect((err as CliError).exitCode).toBe(ExitCode.Unexpected);
        expect((err as CliError).message).toMatch(/unexpected shape/);
      }
    }
  });
});

describe('adminLoginQuery', () => {
  it('asks MCID for a CLI login with a loopback redirect and an S256 challenge', () => {
    const query = adminLoginQuery(
      'http://127.0.0.1:53123/callback',
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    expect(Object.fromEntries(query)).toEqual({
      redirect_uri: 'http://127.0.0.1:53123/callback',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
    });
  });
});

describe('parseAdminLoginSession', () => {
  it('returns the token and expiry from a well-shaped response', () => {
    expect(parseAdminLoginSession({ token: 't0k', expiresAt: '2026-10-08T00:00:00.000Z' })).toEqual(
      {
        token: 't0k',
        expiresAt: '2026-10-08T00:00:00.000Z',
      },
    );
  });

  it('rejects anything else as an unexpected shape', () => {
    for (const body of [
      null,
      {},
      { token: '', expiresAt: 'x' },
      { token: 't' },
      { token: 1, expiresAt: 'x' },
    ]) {
      expect(() => parseAdminLoginSession(body)).toThrow(/unexpected shape/);
    }
  });
});

describe('exchangeAdminLoginCode', () => {
  it('sends the exchange to MCID and reports an unreachable MCID as exit 5', async () => {
    // Nothing listens on the discard port: proves a request is attempted, with no fake MCID.
    const err = await exchangeAdminLoginCode('http://127.0.0.1:9', 'code', 'verifier').then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(CliError);
    expect((err as CliError).exitCode).toBe(ExitCode.Unexpected);
    expect((err as CliError).message).toMatch(/could not reach MCID at http:\/\/127\.0\.0\.1:9/);
  });
});
