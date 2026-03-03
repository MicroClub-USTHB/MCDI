import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  extractBearerToken,
  extractApiKey,
  validateSession,
} from './auth.util';

// ── Helpers ────────────────────────────────────────────────────────────────

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

// ── extractBearerToken ────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('returns the token when Authorization: Bearer <token> is present', () => {
    const req = fakeRequest({
      headers: { authorization: 'Bearer my-token-123' },
    });
    expect(extractBearerToken(req)).toBe('my-token-123');
  });

  it('returns null when Authorization header is missing', () => {
    const req = fakeRequest({ headers: {} });
    expect(extractBearerToken(req)).toBeNull();
  });

  it('returns null when scheme is not Bearer', () => {
    const req = fakeRequest({ headers: { authorization: 'Basic abc123' } });
    expect(extractBearerToken(req)).toBeNull();
  });

  it('returns null when Authorization is empty string', () => {
    const req = fakeRequest({ headers: { authorization: '' } });
    expect(extractBearerToken(req)).toBeNull();
  });
});

// ── extractApiKey ─────────────────────────────────────────────────────────

describe('extractApiKey', () => {
  it('prefers Authorization: Bearer over X-API-Key and query param', () => {
    const req = fakeRequest({
      headers: {
        authorization: 'Bearer bearer-key',
        'x-api-key': 'header-key',
      },
      query: { apiKey: 'query-key' } as any,
    });
    expect(extractApiKey(req)).toBe('bearer-key');
  });

  it('falls back to X-API-Key header when no Bearer', () => {
    const req = fakeRequest({
      headers: { 'x-api-key': 'header-key' },
      query: { apiKey: 'query-key' } as any,
    });
    expect(extractApiKey(req)).toBe('header-key');
  });

  it('falls back to query param when no Bearer and no header', () => {
    const req = fakeRequest({
      headers: {},
      query: { apiKey: 'query-key' } as any,
    });
    expect(extractApiKey(req)).toBe('query-key');
  });

  it('returns null when no API key is present anywhere', () => {
    const req = fakeRequest({ headers: {}, query: {} as any });
    expect(extractApiKey(req)).toBeNull();
  });
});

// ── validateSession ───────────────────────────────────────────────────────

describe('validateSession', () => {
  const buildMockDb = (rows: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  it('returns memberId for a valid, non-expired session', async () => {
    const future = new Date(Date.now() + 1_000_000);
    const db = buildMockDb([{ memberId: 'user-1', expiresAt: future }]);
    const result = await validateSession(db as any, 'valid-token');
    expect(result).toBe('user-1');
  });

  it('throws UnauthorizedException when session is not found', async () => {
    const db = buildMockDb([]);
    await expect(validateSession(db as any, 'missing-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when session is expired', async () => {
    const past = new Date(Date.now() - 1_000);
    const db = buildMockDb([{ memberId: 'user-1', expiresAt: past }]);
    await expect(validateSession(db as any, 'expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
