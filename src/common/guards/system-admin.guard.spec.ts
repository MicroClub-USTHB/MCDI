import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SystemAdminGuard } from './system-admin.guard';
import { DRIZZLE } from '../../database/database.module';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContext(authHeader?: string): ExecutionContext {
  const request = { headers: authHeader ? { authorization: authHeader } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SystemAdminGuard', () => {
  let guard: SystemAdminGuard;
  // We set up a DB that drives multiple sequential select().from().where().limit() calls
  // 1st call  → sessions table (validateSession)
  // 2nd call  → members table  (isSystemAdmin fast-path)
  // 3rd call  → servers table  (find main server)
  // 4th call  → server_members table
  // 5th call  → server_member_roles + roles join (get role names)

  const buildMockDb = (
    sessionRows: any[],
    isAdminRows: any[],
    serverRows: any[],
    memberRows: any[],
    roleRows: any[],
  ) => {
    const allResults = [sessionRows, isAdminRows, serverRows, memberRows, roleRows];
    let callIdx = 0;
    const nextResult = () => allResults[callIdx++] ?? [];

    const makeChain = (): any => {
      const chain: any = {};
      chain.from = jest.fn().mockReturnValue(chain);
      chain.where = jest.fn().mockReturnValue(chain);
      chain.innerJoin = jest.fn().mockReturnValue(chain);
      chain.limit = jest
        .fn()
        .mockImplementation(() => Promise.resolve(nextResult()));
      // Thenable so queries without .limit() (e.g. roles join) resolve correctly
      chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) =>
        Promise.resolve(nextResult()).then(resolve, reject);
      return chain;
    };

    // db itself is NOT thenable — prevents NestJS DI from resolving it as a Promise
    return { select: jest.fn().mockImplementation(makeChain) };
  };

  async function buildGuard(db: any) {
    const module = await Test.createTestingModule({
      providers: [SystemAdminGuard, { provide: DRIZZLE, useValue: db }],
    }).compile();
    return module.get(SystemAdminGuard);
  }

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const db = buildMockDb([], [], [], [], []);
    guard = await buildGuard(db);
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when session is invalid (not found)', async () => {
    const db = buildMockDb(
      [], // session not found
      [],
      [],
      [],
      [],
    );
    guard = await buildGuard(db);
    await expect(
      guard.canActivate(makeContext('Bearer bad-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when session is expired', async () => {
    const past = new Date(Date.now() - 10_000);
    const db = buildMockDb([{ memberId: 'u1', expiresAt: past }], [], [], [], []);
    guard = await buildGuard(db);
    await expect(
      guard.canActivate(makeContext('Bearer expired-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when no main server is configured', async () => {
    const future = new Date(Date.now() + 999_999_999);
    const db = buildMockDb(
      [{ memberId: 'u1', expiresAt: future }],
      [{ isSystemAdmin: false }], // not a system admin
      [], // no main server
      [],
      [],
    );
    guard = await buildGuard(db);
    await expect(
      guard.canActivate(makeContext('Bearer valid-token')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when member is not in main server', async () => {
    const future = new Date(Date.now() + 999_999_999);
    const db = buildMockDb(
      [{ memberId: 'u1', expiresAt: future }],
      [{ isSystemAdmin: false }],
      [{ id: 'guild-1' }],
      [], // member not in server
      [],
    );
    guard = await buildGuard(db);
    await expect(
      guard.canActivate(makeContext('Bearer valid-token')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when member has no admin role', async () => {
    const future = new Date(Date.now() + 999_999_999);
    const db = buildMockDb(
      [{ memberId: 'u1', expiresAt: future }],
      [{ isSystemAdmin: false }],
      [{ id: 'guild-1' }],
      [{ memberId: 'u1' }],
      [{ name: 'Member' }],
    );
    guard = await buildGuard(db);
    await expect(
      guard.canActivate(makeContext('Bearer valid-token')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns true for a valid admin with Executive role', async () => {
    const future = new Date(Date.now() + 999_999_999);
    const db = buildMockDb(
      [{ memberId: 'u1', expiresAt: future }],
      [{ isSystemAdmin: false }],
      [{ id: 'guild-1' }],
      [{ memberId: 'u1' }],
      [{ name: 'Executive' }],
    );
    guard = await buildGuard(db);
    const result = await guard.canActivate(makeContext('Bearer valid-token'));
    expect(result).toBe(true);
  });

  it('returns true for a valid admin with Lead role', async () => {
    const future = new Date(Date.now() + 999_999_999);
    const db = buildMockDb(
      [{ memberId: 'u1', expiresAt: future }],
      [{ isSystemAdmin: false }],
      [{ id: 'guild-1' }],
      [{ memberId: 'u1' }],
      [{ name: 'Lead' }],
    );
    guard = await buildGuard(db);
    const result = await guard.canActivate(makeContext('Bearer valid-token'));
    expect(result).toBe(true);
  });
});
