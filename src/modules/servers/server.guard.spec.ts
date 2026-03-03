import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ServerActiveGuard } from './server.guard';
import { DRIZZLE } from '../../database/database.module';

function buildDb(finalValue: unknown = []) {
  function makeChain(): any {
    const chain: any = {};
    ['from', 'where', 'limit'].forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }
  return { select: jest.fn().mockImplementation(makeChain) };
}

function buildContext(
  overrides: {
    url?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): ExecutionContext {
  const req = {
    originalUrl: overrides.url ?? '/api/members',
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    headers: overrides.headers ?? {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

async function buildGuard(db: any): Promise<ServerActiveGuard> {
  const mod = await Test.createTestingModule({
    providers: [ServerActiveGuard, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(ServerActiveGuard);
}

describe('ServerActiveGuard', () => {
  describe('server-management bypass', () => {
    it('returns true immediately for /servers URLs (no DB call needed)', async () => {
      const db = buildDb([]);
      const guard = await buildGuard(db);
      const ctx = buildContext({ url: '/api/servers' });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('returns true for /servers/{id} URLs', async () => {
      const db = buildDb([]);
      const guard = await buildGuard(db);
      const ctx = buildContext({ url: '/api/servers/srv-1/roles' });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('no serverId present', () => {
    it('returns true when no serverId can be found on the request', async () => {
      const db = buildDb([]);
      const guard = await buildGuard(db);
      const ctx = buildContext({ url: '/api/members' });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('active server', () => {
    it('returns true when server.isActive is true (from params)', async () => {
      const db = buildDb([{ isActive: true }]);
      const guard = await buildGuard(db);
      const ctx = buildContext({
        url: '/api/projects/proj-1/check',
        params: { serverId: 'srv-1' },
      });
      expect(await guard.canActivate(ctx)).toBe(true);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('returns true when serverId comes from the x-server-id header', async () => {
      const db = buildDb([{ isActive: true }]);
      const guard = await buildGuard(db);
      const ctx = buildContext({
        url: '/api/permissions/check',
        headers: { 'x-server-id': 'srv-1' },
      });
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when serverId comes from body', async () => {
      const db = buildDb([{ isActive: true }]);
      const guard = await buildGuard(db);
      const ctx = buildContext({
        url: '/api/permissions/check',
        body: { serverId: 'srv-1' },
      });
      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it('returns true when serverId comes from query', async () => {
      const db = buildDb([{ isActive: true }]);
      const guard = await buildGuard(db);
      const ctx = buildContext({
        url: '/api/permissions/check',
        query: { serverId: 'srv-1' },
      });
      expect(await guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('disabled server', () => {
    it('throws ForbiddenException when isActive is false', async () => {
      const db = buildDb([{ isActive: false }]);
      const guard = await buildGuard(db);
      const ctx = buildContext({
        url: '/api/permissions/check',
        params: { serverId: 'srv-1' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when server row is not found', async () => {
      const db = buildDb([]); // empty result → row?.isActive is undefined/falsy
      const guard = await buildGuard(db);
      const ctx = buildContext({
        url: '/api/permissions/check',
        params: { serverId: 'unknown' },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
