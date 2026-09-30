import { createHash } from 'crypto';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';

describe('refresh-token.util', () => {
  describe('generateRefreshToken', () => {
    it('returns a 96-char hex string (48 random bytes)', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[0-9a-f]{96}$/);
    });

    it('returns a different token on each call', () => {
      expect(generateRefreshToken()).not.toEqual(generateRefreshToken());
    });
  });

  describe('hashRefreshToken', () => {
    it('produces the SHA-256 hex digest of the token', () => {
      const token = 'some-refresh-token';
      const expected = createHash('sha256').update(token).digest('hex');
      expect(hashRefreshToken(token)).toBe(expected);
    });

    it('is deterministic for the same input', () => {
      expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'));
    });

    it('never returns the plaintext token', () => {
      const token = generateRefreshToken();
      expect(hashRefreshToken(token)).not.toBe(token);
    });
  });
});
