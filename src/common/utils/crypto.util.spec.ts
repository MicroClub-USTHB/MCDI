import { randomBytes } from 'crypto';
import {
  encryptSecret,
  decryptSecret,
  getEncryptionKey,
  resetEncryptionKeyCache,
  timingSafeEqualHex,
} from './crypto.util';

const KEY = randomBytes(32);
const OTHER = randomBytes(32);

describe('crypto.util', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_ENCRYPTION_KEY;
    resetEncryptionKeyCache();
  });

  describe('getEncryptionKey', () => {
    it('throws when the key is absent — boot must fail, not fall back', () => {
      resetEncryptionKeyCache();
      expect(() => getEncryptionKey()).toThrow(
        /WEBHOOK_ENCRYPTION_KEY is not set/,
      );
    });

    it('throws when the key is the wrong length', () => {
      process.env.WEBHOOK_ENCRYPTION_KEY = randomBytes(16).toString('base64');
      resetEncryptionKeyCache();
      expect(() => getEncryptionKey()).toThrow(/exactly 32 bytes/);
    });

    it('accepts a correct key', () => {
      process.env.WEBHOOK_ENCRYPTION_KEY = KEY.toString('base64');
      resetEncryptionKeyCache();
      expect(getEncryptionKey()).toEqual(KEY);
    });
  });

  describe('encrypt / decrypt', () => {
    it('round trips', () => {
      const secret = 'whsec_deadbeef';
      expect(decryptSecret(encryptSecret(secret, KEY), KEY)).toBe(secret);
    });

    it('produces different ciphertext each time (random IV)', () => {
      expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
    });

    it('fails to decrypt with the wrong key', () => {
      expect(() => decryptSecret(encryptSecret('x', KEY), OTHER)).toThrow();
    });

    it('fails on tampered ciphertext (GCM auth tag)', () => {
      const encoded = encryptSecret('x', KEY);
      const buf = Buffer.from(encoded, 'base64');
      buf[buf.length - 1] ^= 0xff;
      expect(() => decryptSecret(buf.toString('base64'), KEY)).toThrow();
    });

    it('rejects a truncated payload', () => {
      expect(() =>
        decryptSecret(Buffer.alloc(8).toString('base64'), KEY),
      ).toThrow(/malformed/);
    });

    it('handles unicode', () => {
      const s = 'clé-secrète-🔐';
      expect(decryptSecret(encryptSecret(s, KEY), KEY)).toBe(s);
    });
  });

  describe('timingSafeEqualHex', () => {
    it('matches identical hex', () => {
      expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    });
    it('rejects different hex and mismatched lengths', () => {
      expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
      expect(timingSafeEqualHex('abcd', 'abcdef')).toBe(false);
    });
  });
});
