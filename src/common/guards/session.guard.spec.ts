import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SessionGuard, RequestWithSession } from './session.guard';
import { DRIZZLE } from '../../database/database.module';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

// Drives validateSession's select().from().where().limit() chain.
const buildMockDb = (sessionRows: unknown[]) => {
  const makeChain = (): any => {
    const chain: any = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.where = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockResolvedValue(sessionRows);
    return chain;
  };
  return { select: jest.fn().mockImplementation(makeChain) };
};

async function buildGuard(db: unknown): Promise<SessionGuard> {
  const module = await Test.createTestingModule({
    providers: [SessionGuard, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return module.get(SessionGuard);
}

describe('SessionGuard', () => {
  it('throws when no token is present', async () => {
    const guard = await buildGuard(buildMockDb([]));
    await expect(
      guard.canActivate(makeContext({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the session is not found', async () => {
    const guard = await buildGuard(buildMockDb([]));
    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer bad' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when the session is expired', async () => {
    const guard = await buildGuard(
      buildMockDb([
        { memberId: 'm1', expiresAt: new Date(Date.now() - 10_000) },
      ]),
    );
    await expect(
      guard.canActivate(
        makeContext({ headers: { authorization: 'Bearer expired' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns true and attaches memberId + sessionToken for a valid session', async () => {
    const guard = await buildGuard(
      buildMockDb([
        { memberId: 'm1', expiresAt: new Date(Date.now() + 60_000) },
      ]),
    );
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer good-token' },
    };

    const result = await guard.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect((request as unknown as RequestWithSession).memberId).toBe('m1');
    expect((request as unknown as RequestWithSession).sessionToken).toBe(
      'good-token',
    );
  });

  it('accepts the admin_session cookie as a token source', async () => {
    const guard = await buildGuard(
      buildMockDb([
        { memberId: 'm2', expiresAt: new Date(Date.now() + 60_000) },
      ]),
    );
    const request: Record<string, unknown> = {
      headers: {},
      cookies: { admin_session: 'cookie-token' },
    };

    const result = await guard.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect((request as unknown as RequestWithSession).memberId).toBe('m2');
  });
});
