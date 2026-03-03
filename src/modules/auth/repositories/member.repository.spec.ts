import { Test } from '@nestjs/testing';
import { MemberRepository } from './member.repository';
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

function buildSequentialDb(results: unknown[]) {
  let i = 0;
  const next = () => {
    const v = results[i] ?? [];
    i++;
    return v;
  };
  function makeChain(): any {
    const value = next();
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
    chain.returning = jest.fn().mockResolvedValue(value);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(value).then(resolve, reject);
    return chain;
  }
  return {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  };
}

async function buildRepo(db: any): Promise<MemberRepository> {
  const mod = await Test.createTestingModule({
    providers: [MemberRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(MemberRepository);
}

const fakeMember = (overrides: Record<string, unknown> = {}) => ({
  id: 'mem-1',
  username: 'alice',
  globalName: 'Alice',
  displayName: 'alice123',
  avatar: null,
  email: 'alice@example.com',
  isClubMember: false,
  syncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MemberRepository (auth)', () => {
  describe('findById', () => {
    it('returns member when found', async () => {
      const member = fakeMember();
      const db = buildDb([member]);
      const repo = await buildRepo(db);
      expect(await repo.findById('mem-1')).toEqual(member);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findById('ghost')).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns member for matching email', async () => {
      const member = fakeMember();
      const db = buildDb([member]);
      const repo = await buildRepo(db);
      expect(await repo.findByEmail('alice@example.com')).toEqual(member);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByEmail('no@example.com')).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('returns member for matching username', async () => {
      const member = fakeMember();
      const db = buildDb([member]);
      const repo = await buildRepo(db);
      expect(await repo.findByUsername('alice')).toEqual(member);
    });
  });

  describe('findClubMembers', () => {
    it('returns list of club members', async () => {
      const members = [fakeMember({ isClubMember: true })];
      const db = buildDb(members);
      const repo = await buildRepo(db);
      expect(await repo.findClubMembers()).toEqual(members);
    });
  });

  describe('findAll', () => {
    it('returns paginated members', async () => {
      const members = [fakeMember()];
      const db = buildDb(members);
      const repo = await buildRepo(db);
      expect(await repo.findAll(10, 0)).toEqual(members);
    });
  });

  describe('search', () => {
    it('returns matching members', async () => {
      const members = [fakeMember()];
      const db = buildDb(members);
      const repo = await buildRepo(db);
      expect(await repo.search('alice')).toEqual(members);
    });
  });

  describe('create', () => {
    it('inserts and returns the new member', async () => {
      const member = fakeMember();
      const db = buildDb([member]);
      const repo = await buildRepo(db);
      const result = await repo.create({ id: 'mem-1', username: 'alice' });
      expect(result).toEqual(member);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('updates and returns the member', async () => {
      const updated = fakeMember({ username: 'alice_new' });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);
      const result = await repo.update('mem-1', { username: 'alice_new' });
      expect(result).toMatchObject({ username: 'alice_new' });
    });

    it('returns null when member not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.update('ghost', { username: 'x' })).toBeNull();
    });
  });

  describe('upsert — member exists', () => {
    it('calls findById then update path (sequential: [existing, updated])', async () => {
      const existing = fakeMember();
      const updated = fakeMember({ username: 'alice_v2' });
      // findById → select ([existing]);  update → update ([updated])
      const db = buildSequentialDb([[existing], [updated]]) as any;
      const repo = await buildRepo(db);
      const result = await repo.upsert({ id: 'mem-1', username: 'alice_v2' });
      expect(result).toMatchObject({ username: 'alice_v2' });
    });
  });

  describe('upsert — member not found', () => {
    it('calls findById then create path (sequential: [[], created])', async () => {
      const created = fakeMember({ id: 'mem-2' });
      // findById → [] (not found); insert → [created]
      const db = buildSequentialDb([[], [created]]) as any;
      const repo = await buildRepo(db);
      const result = await repo.upsert({ id: 'mem-2', username: 'bob' });
      expect(result).toMatchObject({ id: 'mem-2' });
    });
  });

  describe('delete', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.delete('mem-1')).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('setClubMemberStatus', () => {
    it('returns updated member', async () => {
      const member = fakeMember({ isClubMember: true });
      const db = buildDb([member]);
      const repo = await buildRepo(db);
      const result = await repo.setClubMemberStatus('mem-1', true);
      expect(result).toMatchObject({ isClubMember: true });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.setClubMemberStatus('ghost', false)).toBeNull();
    });
  });

  describe('updateSyncedAt', () => {
    it('returns updated member', async () => {
      const member = fakeMember({ syncedAt: new Date() });
      const db = buildDb([member]);
      const repo = await buildRepo(db);
      const result = await repo.updateSyncedAt('mem-1');
      expect(result).toMatchObject({ id: 'mem-1' });
    });
  });
});
