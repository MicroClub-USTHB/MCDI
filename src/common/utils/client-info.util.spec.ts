import { Request } from 'express';
import { extractClientInfo } from './client-info.util';

const makeReq = (overrides: Partial<Request>): Request =>
  ({ headers: {}, ...overrides }) as Request;

describe('extractClientInfo', () => {
  it('prefers the first X-Forwarded-For hop', () => {
    const req = makeReq({
      headers: {
        'x-forwarded-for': '203.0.113.1, 70.41.3.18',
        'user-agent': 'jest-agent',
      },
      ip: '10.0.0.1',
    });

    expect(extractClientInfo(req)).toEqual({
      ipAddress: '203.0.113.1',
      userAgent: 'jest-agent',
    });
  });

  it('falls back to req.ip when no forwarded header is present', () => {
    const req = makeReq({ headers: {}, ip: '10.0.0.5' });

    expect(extractClientInfo(req)).toEqual({
      ipAddress: '10.0.0.5',
      userAgent: null,
    });
  });

  it('returns nulls when neither forwarded header nor req.ip is available', () => {
    const req = makeReq({ headers: {}, ip: undefined });

    expect(extractClientInfo(req)).toEqual({
      ipAddress: null,
      userAgent: null,
    });
  });

  it('drops a forwarded IP that would overflow the column', () => {
    const req = makeReq({
      headers: { 'x-forwarded-for': 'x'.repeat(60) },
      ip: '10.0.0.9',
    });

    expect(extractClientInfo(req).ipAddress).toBeNull();
  });

  it('caps an oversized user agent', () => {
    const req = makeReq({ headers: { 'user-agent': 'a'.repeat(1000) } });

    expect(extractClientInfo(req).userAgent).toHaveLength(512);
  });
});
