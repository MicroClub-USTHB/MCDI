import { createHash } from 'crypto';
import { generateSsoToken, hashSsoToken } from './sso-token.util';

describe('sso-token.util', () => {
  describe('generateSsoToken', () => {
    it('returns 96 lowercase hex chars (384 bits)', () => {
      const token = generateSsoToken();
      expect(token).toMatch(/^[0-9a-f]{96}$/);
    });

    it('produces unique values across calls', () => {
      const tokens = new Set(
        Array.from({ length: 50 }, () => generateSsoToken()),
      );
      expect(tokens.size).toBe(50);
    });
  });

  describe('hashSsoToken', () => {
    it('is deterministic SHA-256 of the input', () => {
      const expected = createHash('sha256').update('hello').digest('hex');
      expect(hashSsoToken('hello')).toBe(expected);
      expect(hashSsoToken('hello')).toBe(hashSsoToken('hello'));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashSsoToken('a')).not.toBe(hashSsoToken('b'));
    });
  });
});
