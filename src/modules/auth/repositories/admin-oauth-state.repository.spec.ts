import { Test } from '@nestjs/testing';
import { AdminOAuthStateRepository } from './admin-oauth-state.repository';
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

async function buildRepo(db: any): Promise<AdminOAuthStateRepository> {
  const mod = await Test.createTestingModule({
    providers: [AdminOAuthStateRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(AdminOAuthStateRepository);
}

const fakeState = (overrides: Record<string, unknown> = {}) => ({
  id: 'state-uuid-1',
  state: 'admin-rand-state-123',
  used: 'false',
  expiresAt: new Date(Date.now() + 300_000),
  createdAt: new Date(),
  ...overrides,
});

describe('AdminOAuthStateRepository', () => {
  describe('create', () => {
    it('inserts and returns the created state', async () => {
      const state = fakeState();
      const db = buildDb([state]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        state: 'admin-rand-state-123',
        expiresAt: state.expiresAt,
      });
      expect(result).toEqual(state);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('findValidState', () => {
    it('returns the state record when found', async () => {
      const state = fakeState();
      const db = buildDb([state]);
      const repo = await buildRepo(db);
      const result = await repo.findValidState('admin-rand-state-123');
      expect(result).toEqual(state);
    });

    it('returns null when no valid state found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findValidState('unknown-state')).toBeNull();
    });
  });

  describe('markAsUsed', () => {
    it('calls update without errors', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(
        repo.markAsUsed('admin-rand-state-123'),
      ).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalledTimes(1);
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
