import { describe, expect, it } from 'vitest';
import { codeChallengeFor, createPkcePair } from './pkce.js';

describe('PKCE', () => {
  it('computes the S256 challenge from RFC 7636 Appendix B', () => {
    expect(codeChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('creates a 43-character base64url verifier with its matching challenge', () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(codeChallengeFor(verifier));
    expect(challenge).not.toBe(verifier);
  });

  it('creates a fresh verifier every time', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => createPkcePair().verifier));
    expect(verifiers.size).toBe(50);
  });
});
