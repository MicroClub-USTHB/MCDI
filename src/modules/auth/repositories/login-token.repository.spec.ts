import { Test } from '@nestjs/testing';
import { LoginTokenRepository } from './login-token.repository';
import { DRIZZLE } from '../../../database/database.module';

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
    ].forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
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

async function buildRepo(db: any): Promise<LoginTokenRepository> {
  const mod = await Test.createTestingModule({
    providers: [LoginTokenRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(LoginTokenRepository);
}

const fakeToken = (overrides: Record<string, unknown> = {}) => ({
  id: 'tok-uuid-1',
  token: 'abc123',
  projectId: 'proj-1',
  serverId: 'srv-1',
  redirectUri: 'https://app.example.com/cb',
  expiresAt: new Date(Date.now() + 300_000),
  createdAt: new Date(),
  ...overrides,
});

describe('LoginTokenRepository', () => {
  describe('create', () => {
    it('inserts and returns the created token', async () => {
      const token = fakeToken();
      const db = buildDb([token]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        token: 'abc123',
        projectId: 'proj-1',
        serverId: 'srv-1',
        redirectUri: 'https://app.example.com/cb',
        expiresAt: token.expiresAt,
      });
      expect(result).toEqual(token);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('findValid', () => {
    it('returns the token when it is valid and not expired', async () => {
      const token = fakeToken({ expiresAt: new Date(Date.now() + 300_000) });
      const db = buildDb([token]);
      const repo = await buildRepo(db);
      const result = await repo.findValid('abc123');
      expect(result).toEqual(token);
    });

    it('returns null when token is not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findValid('nonexistent')).toBeNull();
    });

    it('returns null when token is expired', async () => {
      const expired = fakeToken({ expiresAt: new Date(Date.now() - 1000) });
      const db = buildDb([expired]);
      const repo = await buildRepo(db);
      expect(await repo.findValid('abc123')).toBeNull();
    });
  });

  describe('deleteExpired', () => {
    it('calls delete without errors', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteExpired()).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });
});
