import { Test } from '@nestjs/testing';
import { OAuthStateRepository } from './oauth-state.repository';
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

async function buildRepo(db: any): Promise<OAuthStateRepository> {
  const mod = await Test.createTestingModule({
    providers: [OAuthStateRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(OAuthStateRepository);
}

const fakeState = (overrides: Record<string, unknown> = {}) => ({
  id: 'state-uuid-1',
  state: 'rand-state-123',
  used: 'false',
  expiresAt: new Date(Date.now() + 300_000),
  createdAt: new Date(),
  ...overrides,
});

describe('OauthStateRepository', () => {
  describe('create', () => {
    it('inserts and returns the created state', async () => {
      const state = fakeState();
      const db = buildDb([state]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        state: 'rand-state-123',
        projectId: 'proj-1',
        serverId: 'srv-1',
        redirectUri: 'https://app.example.com/cb',
        apiKey: 'pfx.secret',
        expiresAt: state.expiresAt,
      });
      expect(result).toEqual(state);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('findValidState', () => {
    it('returns valid (unused, non-expired) state when found', async () => {
      const state = fakeState();
      const db = buildDb([state]);
      const repo = await buildRepo(db);
      const result = await repo.findValidState('rand-state-123');
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
      await expect(repo.markAsUsed('rand-state-123')).resolves.toBeUndefined();
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
