import {
  computeSignature,
  generateSigningSecret,
  parseSignatureHeader,
  signPayload,
  verifySignature,
} from './inbound-webhook-signature.util';

const SECRET = 'whsec_test';
const BODY = '{"identity":{"name":"Ada"}}';
const NOW = new Date('2026-01-01T00:00:00Z');
const TS = Math.floor(NOW.getTime() / 1000);

describe('inbound-webhook-signature.util', () => {
  it('generates a prefixed, high-entropy secret', () => {
    const s = generateSigningSecret();
    expect(s).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(s).not.toBe(generateSigningSecret());
  });

  describe('parseSignatureHeader', () => {
    it('parses a well-formed header', () => {
      expect(parseSignatureHeader('t=123,v1=abcd')).toEqual({
        timestamp: 123,
        signature: 'abcd',
      });
    });
    it('tolerates whitespace and ordering', () => {
      expect(parseSignatureHeader('v1=ABCD, t=123')).toEqual({
        timestamp: 123,
        signature: 'abcd',
      });
    });
    it('rejects malformed input', () => {
      expect(parseSignatureHeader('')).toBeNull();
      expect(parseSignatureHeader('garbage')).toBeNull();
      expect(parseSignatureHeader('t=abc,v1=abcd')).toBeNull();
      expect(parseSignatureHeader('t=123,v1=zzzz')).toBeNull();
      expect(parseSignatureHeader('t=123')).toBeNull();
    });
  });

  describe('verifySignature', () => {
    const header = signPayload(SECRET, BODY, TS);

    it('accepts a valid signature', () => {
      const r = verifySignature({
        header,
        secret: SECRET,
        rawBody: BODY,
        now: NOW,
      });
      expect(r.ok).toBe(true);
    });

    it('accepts a Buffer body identically to a string body', () => {
      const r = verifySignature({
        header,
        secret: SECRET,
        rawBody: Buffer.from(BODY),
        now: NOW,
      });
      expect(r.ok).toBe(true);
    });

    it('rejects a tampered body', () => {
      const r = verifySignature({
        header,
        secret: SECRET,
        rawBody: BODY + ' ',
        now: NOW,
      });
      expect(r).toEqual({ ok: false, reason: 'SIGNATURE_MISMATCH' });
    });

    it('rejects the wrong secret', () => {
      const r = verifySignature({
        header,
        secret: 'whsec_other',
        rawBody: BODY,
        now: NOW,
      });
      expect(r).toEqual({ ok: false, reason: 'SIGNATURE_MISMATCH' });
    });

    it('rejects a truncated signature', () => {
      const r = verifySignature({
        header: header.slice(0, -2),
        secret: SECRET,
        rawBody: BODY,
        now: NOW,
      });
      expect(r).toEqual({ ok: false, reason: 'SIGNATURE_MISMATCH' });
    });

    it('rejects a stale timestamp outside the tolerance', () => {
      const late = new Date(NOW.getTime() + 301_000);
      expect(
        verifySignature({ header, secret: SECRET, rawBody: BODY, now: late }),
      ).toEqual({ ok: false, reason: 'STALE_TIMESTAMP' });
    });

    it('accepts a timestamp just inside the tolerance', () => {
      const late = new Date(NOW.getTime() + 299_000);
      expect(
        verifySignature({ header, secret: SECRET, rawBody: BODY, now: late })
          .ok,
      ).toBe(true);
    });

    it('rejects a future timestamp beyond the tolerance', () => {
      const early = new Date(NOW.getTime() - 301_000);
      expect(
        verifySignature({ header, secret: SECRET, rawBody: BODY, now: early }),
      ).toEqual({ ok: false, reason: 'STALE_TIMESTAMP' });
    });

    it('rejects a missing or malformed header', () => {
      expect(
        verifySignature({
          header: undefined,
          secret: SECRET,
          rawBody: BODY,
          now: NOW,
        }),
      ).toEqual({ ok: false, reason: 'MALFORMED_HEADER' });
      expect(
        verifySignature({
          header: 'nonsense',
          secret: SECRET,
          rawBody: BODY,
          now: NOW,
        }),
      ).toEqual({ ok: false, reason: 'MALFORMED_HEADER' });
    });

    it('is sensitive to key order — the reason raw body matters', () => {
      const reordered = '{"identity":{"name":"Ada"},"x":1}';
      const sig = computeSignature(SECRET, TS, reordered);
      expect(sig).not.toBe(
        computeSignature(SECRET, TS, '{"x":1,"identity":{"name":"Ada"}}'),
      );
    });
  });
});
