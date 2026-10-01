import { encryptSecret, decryptSecret } from './encryption.util';

const KEY = 'a'.repeat(64);

describe('encryption.util', () => {
  it('round-trips a secret through encrypt and decrypt', () => {
    const payload = encryptSecret('webhook-token-value', KEY);
    expect(payload).not.toContain('webhook-token-value');
    expect(decryptSecret(payload, KEY)).toBe('webhook-token-value');
  });

  it('produces a different payload for the same plaintext (random IV)', () => {
    const a = encryptSecret('same-secret', KEY);
    const b = encryptSecret('same-secret', KEY);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with a different key', () => {
    const payload = encryptSecret('secret', KEY);
    expect(() => decryptSecret(payload, 'b'.repeat(64))).toThrow();
  });

  it('fails to decrypt a tampered payload (auth tag check)', () => {
    const payload = encryptSecret('secret', KEY);
    const [iv, tag, ciphertext] = payload.split('.');
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[0] ^= 0xff;
    expect(() =>
      decryptSecret(`${iv}.${tag}.${tampered.toString('base64')}`, KEY),
    ).toThrow();
  });

  it('rejects a key that is not 64 hex characters', () => {
    expect(() => encryptSecret('secret', 'too-short')).toThrow(
      /64 hex characters/,
    );
  });

  it('rejects a malformed payload', () => {
    expect(() => decryptSecret('not-a-payload', KEY)).toThrow();
  });
});
