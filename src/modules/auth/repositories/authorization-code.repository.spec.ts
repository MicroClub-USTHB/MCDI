import { Test } from '@nestjs/testing';
import { AuthorizationCodeRepository } from './authorization-code.repository';
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
  const db: any = {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  };
  return db;
}

async function buildRepo(db: any): Promise<AuthorizationCodeRepository> {
  const mod = await Test.createTestingModule({
    providers: [
      AuthorizationCodeRepository,
      { provide: DRIZZLE, useValue: db },
    ],
  }).compile();
  return mod.get(AuthorizationCodeRepository);
}

const fakeCode = (overrides: Record<string, unknown> = {}) => ({
  id: 'code-uuid-1',
  code: 'auth-code-xyz',
  userId: 'mem-1',
  projectId: 'proj-1',
  serverId: 'srv-1',
  clientId: 'client-1',
  redirectUri: 'https://app.example.com/cb',
  expiresAt: new Date(Date.now() + 600_000),
  used: false,
  createdAt: new Date(),
  ...overrides,
});

describe('AuthorizationCodeRepository', () => {
  describe('findByCode', () => {
    it('returns auth code row when found', async () => {
      const code = fakeCode();
      const db = buildDb([code]);
      const repo = await buildRepo(db);
      expect(await repo.findByCode('auth-code-xyz')).toEqual(code);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByCode('ghost')).toBeNull();
    });
  });

  describe('findByCodeWithUser', () => {
    it('returns flattened auth code + user when found', async () => {
      const code = fakeCode();
      const member = { id: 'mem-1', username: 'alice' };
      const db = buildDb([{ authCode: code, user: member }]);
      const repo = await buildRepo(db);
      const result = await repo.findByCodeWithUser('auth-code-xyz');
      expect(result).not.toBeNull();
      expect(result!.user).toMatchObject({ username: 'alice' });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByCodeWithUser('ghost')).toBeNull();
    });
  });

  describe('findByCodeAndClient', () => {
    it('returns matching code row', async () => {
      const code = fakeCode();
      const db = buildDb([code]);
      const repo = await buildRepo(db);
      const result = await repo.findByCodeAndClient(
        'auth-code-xyz',
        'client-1',
        'https://app.example.com/cb',
      );
      expect(result).toEqual(code);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByCodeAndClient('bad', 'c', 'u')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts and returns the created code', async () => {
      const code = fakeCode();
      const db = buildDb([code]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        code: 'auth-code-xyz',
        userId: 'mem-1',
        clientId: 'client-1',
        redirectUri: 'https://app.example.com/cb',
        expiresAt: code.expiresAt,
      });
      expect(result).toEqual(code);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('markAsUsed', () => {
    it('returns updated code row', async () => {
      const code = fakeCode({ used: true });
      const db = buildDb([code]);
      const repo = await buildRepo(db);
      expect(await repo.markAsUsed('auth-code-xyz')).toMatchObject({
        used: true,
      });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.markAsUsed('ghost')).toBeNull();
    });
  });

  describe('deleteByCode', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteByCode('auth-code-xyz')).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteExpired', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteExpired()).resolves.toBeUndefined();
    });
  });

  describe('deleteByUserId', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteByUserId('mem-1')).resolves.toBeUndefined();
    });
  });

  describe('findByUserId', () => {
    it('returns codes for user', async () => {
      const codes = [fakeCode()];
      const db = buildDb(codes);
      const repo = await buildRepo(db);
      expect(await repo.findByUserId('mem-1')).toEqual(codes);
    });
  });
});
