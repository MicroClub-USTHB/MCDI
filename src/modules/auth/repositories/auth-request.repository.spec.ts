import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../../database/database.module';
import { AuthRequestRepository } from './auth-request.repository';

function buildDb(finalValue: unknown = []) {
  function makeChain(): any {
    const chain: any = {};
    [
      'from',
      'where',
      'orderBy',
      'innerJoin',
      'leftJoin',
      'set',
      'limit',
      'offset',
      'values',
      'onConflictDoUpdate',
      'onConflictDoNothing',
    ].forEach((method) => {
      chain[method] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }

  return {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  } as any;
}

async function buildRepo(db: any): Promise<AuthRequestRepository> {
  const mod = await Test.createTestingModule({
    providers: [AuthRequestRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();

  return mod.get(AuthRequestRepository);
}

const fakeRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'auth-request-1',
  requestId: 'req-123',
  clientId: 'proj-1',
  redirectUri: 'https://app.example.com/callback',
  state: 'state-1',
  serverId: 'srv-1',
  used: false,
  expiresAt: new Date(Date.now() + 300_000),
  createdAt: new Date(),
  ...overrides,
});

describe('AuthRequestRepository', () => {
  it('creates a request', async () => {
    const authRequest = fakeRequest();
    const repo = await buildRepo(buildDb([authRequest]));

    const result = await repo.create({
      requestId: 'req-123',
      clientId: 'proj-1',
      redirectUri: 'https://app.example.com/callback',
      state: 'state-1',
      serverId: 'srv-1',
      expiresAt: authRequest.expiresAt,
    });

    expect(result).toEqual(authRequest);
  });

  it('finds a valid request', async () => {
    const authRequest = fakeRequest();
    const repo = await buildRepo(buildDb([authRequest]));

    await expect(repo.findValidRequest('req-123')).resolves.toEqual(authRequest);
  });

  it('returns null when request is missing', async () => {
    const repo = await buildRepo(buildDb([]));

    await expect(repo.findValidRequest('missing')).resolves.toBeNull();
  });

  it('marks a request as used', async () => {
    const db = buildDb([]);
    const repo = await buildRepo(db);

    await expect(repo.markAsUsed('req-123')).resolves.toBeUndefined();
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('deletes expired requests', async () => {
    const db = buildDb([]);
    const repo = await buildRepo(db);

    await expect(repo.deleteExpired()).resolves.toBeUndefined();
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});