import { generateApiKey, verifyApiKey } from './api-key.util';

describe('api-key.util', () => {
  // ── generateApiKey ──────────────────────────────────────────────────

  describe('generateApiKey', () => {
    it('returns a fullKey in "pk_<hex>.<secret>" format', () => {
      const { fullKey } = generateApiKey();
      expect(fullKey).toMatch(/^pk_[0-9a-f]{8}\.[0-9a-f]{64}$/);
    });

    it('returns a prefix that matches the start of fullKey', () => {
      const { fullKey, prefix } = generateApiKey();
      expect(fullKey.startsWith(`${prefix}.`)).toBe(true);
    });

    it('returns a 64-char hex hash', () => {
      const { hash } = generateApiKey();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique keys on each call', () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a.fullKey).not.toBe(b.fullKey);
      expect(a.prefix).not.toBe(b.prefix);
      expect(a.hash).not.toBe(b.hash);
    });

    it('hash is the SHA-256 of the secret part of fullKey', () => {
      const { fullKey, prefix, hash } = generateApiKey();
      const secret = fullKey.slice(prefix.length + 1); // strip "prefix."
      // Re-verify using the exported verifyApiKey
      expect(verifyApiKey(secret, hash)).toBe(true);
    });
  });

  // ── verifyApiKey ────────────────────────────────────────────────────

  describe('verifyApiKey', () => {
    it('returns true when secret matches stored hash', () => {
      const { fullKey, prefix, hash } = generateApiKey();
      const secret = fullKey.slice(prefix.length + 1);
      expect(verifyApiKey(secret, hash)).toBe(true);
    });

    it('returns false when secret is tampered', () => {
      const { hash } = generateApiKey();
      expect(verifyApiKey('wrong_secret', hash)).toBe(false);
    });

    it('returns false when hash is from a different key', () => {
      const a = generateApiKey();
      const b = generateApiKey();
      const secretA = a.fullKey.slice(a.prefix.length + 1);
      expect(verifyApiKey(secretA, b.hash)).toBe(false);
    });

    it('returns false when storedHash length differs (prevents length-extension)', () => {
      // Truncated hash → different buffer length → timingSafeEqual guard fires
      const { fullKey, prefix } = generateApiKey();
      const secret = fullKey.slice(prefix.length + 1);
      const shortHash = 'deadbeef'; // only 4 bytes as hex
      expect(verifyApiKey(secret, shortHash)).toBe(false);
    });
  });
});
