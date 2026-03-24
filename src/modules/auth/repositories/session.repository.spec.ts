import { Test } from '@nestjs/testing';
import { SessionRepository } from './session.repository';
import { DRIZZLE } from '../../../database/database.module';
import { hashSessionToken } from '../../../common/utils/session-token.util';

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

async function buildRepo(db: any): Promise<SessionRepository> {
  const mod = await Test.createTestingModule({
    providers: [SessionRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(SessionRepository);
}

const fakeSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess-uuid-1',
  memberId: 'mem-1',
  projectId: 'proj-1',
  serverId: 'srv-1',
  token: 'tok-abc',
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  ...overrides,
});

describe('SessionRepository', () => {
  describe('findById', () => {
    it('returns session when found', async () => {
      const session = fakeSession();
      const db = buildDb([session]);
      const repo = await buildRepo(db);
      expect(await repo.findById('sess-uuid-1')).toEqual(session);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findById('ghost')).toBeNull();
    });
  });

  describe('findByToken', () => {
    it('returns session for token', async () => {
      const session = fakeSession();
      const db = buildDb([session]);
      const repo = await buildRepo(db);
      expect(await repo.findByToken('tok-abc')).toEqual(session);
    });
  });

  describe('findByTokenWithMember', () => {
    it('returns flattened session+member when found', async () => {
      const session = fakeSession();
      const member = { id: 'mem-1', username: 'alice' };
      const db = buildDb([{ session, member }]);
      const repo = await buildRepo(db);
      const result = await repo.findByTokenWithMember('tok-abc');
      expect(result).toMatchObject({
        token: 'tok-abc',
        member: { username: 'alice' },
      });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByTokenWithMember('ghost')).toBeNull();
    });
  });

  describe('findByMemberId', () => {
    it('returns list of sessions', async () => {
      const sessions = [fakeSession()];
      const db = buildDb(sessions);
      const repo = await buildRepo(db);
      expect(await repo.findByMemberId('mem-1')).toEqual(sessions);
    });
  });

  describe('findValidByToken', () => {
    it('returns valid (non-expired) session', async () => {
      const session = fakeSession();
      const db = buildDb([session]);
      const repo = await buildRepo(db);
      expect(await repo.findValidByToken('tok-abc')).toEqual(session);
    });

    it('returns null when expired / not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findValidByToken('old-tok')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts and returns the created session', async () => {
      const session = fakeSession();
      const db = buildDb([session]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        memberId: 'mem-1',
        token: 'tok-abc',
        expiresAt: session.expiresAt,
      });
      expect(result).toEqual(session);
    });

    it('hashes the token and preserves project and server scope', async () => {
      const session = fakeSession();
      const db = buildDb([session]);
      const repo = await buildRepo(db);

      await repo.create({
        memberId: 'mem-1',
        projectId: 'proj-1',
        serverId: 'srv-1',
        token: 'tok-plain',
        expiresAt: session.expiresAt,
      });

      const insertChain = db.insert.mock.results[0].value;
      expect(insertChain.values).toHaveBeenCalledWith({
        memberId: 'mem-1',
        projectId: 'proj-1',
        serverId: 'srv-1',
        token: hashSessionToken('tok-plain'),
        expiresAt: session.expiresAt,
      });
    });
  });

  describe('deleteByToken', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteByToken('tok-abc')).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteByMemberId', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteByMemberId('mem-1')).resolves.toBeUndefined();
    });
  });

  describe('deleteExpired', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteExpired()).resolves.toBeUndefined();
    });
  });

  describe('updateExpiration', () => {
    it('returns updated session', async () => {
      const newExpiry = new Date(Date.now() + 172_800_000);
      const session = fakeSession({ expiresAt: newExpiry });
      const db = buildDb([session]);
      const repo = await buildRepo(db);
      const result = await repo.updateExpiration('tok-abc', newExpiry);
      expect(result).toMatchObject({ token: 'tok-abc' });
    });
  });
});