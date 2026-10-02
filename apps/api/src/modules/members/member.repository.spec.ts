import { Test } from '@nestjs/testing';
import { MemberRepository } from './member.repository';
import { DRIZZLE } from '../../database/database.module';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function buildDb(finalValue: unknown = [], txUpdateValue: unknown = []) {
  function makeChain(): any {
    const chain: any = {};
    const methods = [
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
      'groupBy',
      'as',
      'execute',
      '$dynamic',
    ];
    methods.forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }
  function makeChainWithTx(value: unknown): any {
    const chain: any = {};
    const methods = [
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
    ];
    methods.forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(value);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(value).then(resolve, reject);
    return chain;
  }
  const db: any = {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
    transaction: jest.fn().mockImplementation((cb: any) => {
      const tx = {
        select: jest.fn().mockImplementation(() => makeChainWithTx([])),
        insert: jest.fn().mockImplementation(() => makeChainWithTx([])),
        update: jest
          .fn()
          .mockImplementation(() => makeChainWithTx(txUpdateValue)),
        delete: jest.fn().mockImplementation(() => makeChainWithTx([])),
      };
      return cb(tx);
    }),
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
    const methods = [
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
      'groupBy',
      'as',
      'execute',
      '$dynamic',
    ];
    methods.forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(value);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(value).then(resolve, reject);
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

async function buildRepo(db: any): Promise<MemberRepository> {
  const mod = await Test.createTestingModule({
    providers: [MemberRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(MemberRepository);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MemberRepository (members module)', () => {
  // ── findMemberByDiscordId ───────────────────────────────────────────────────

  describe('findMemberByDiscordId', () => {
    it('returns member profile when found', async () => {
      const memberRow = {
        member: {
          id: 'mem-1',
          username: 'alice',
          globalName: 'Alice',
          displayName: 'Alice D',
          avatar: null,
          isClubMember: true,
          syncedAt: new Date(),
        },
        joinedAt: new Date('2024-01-01'),
      };
      const roleRows = [
        { id: 'role-1', name: 'Executive', color: 0xffd700, position: 1 },
      ];
      const db = buildSequentialDb([[memberRow], roleRows]);
      const repo = await buildRepo(db);
      const result = await repo.findMemberByDiscordId('srv-1', 'mem-1');
      expect(result).toMatchObject({ discordId: 'mem-1', username: 'alice' });
      expect(result?.roles).toHaveLength(1);
    });

    it('returns null when member not in server', async () => {
      const db = buildSequentialDb([[], []]);
      const repo = await buildRepo(db);
      expect(await repo.findMemberByDiscordId('srv-1', 'ghost')).toBeNull();
    });
  });

  // ── searchMembers ───────────────────────────────────────────────────────────

  describe('searchMembers', () => {
    it('returns members and total count', async () => {
      const memberRows = [
        {
          id: 'mem-1',
          username: 'alice',
          globalName: null,
          displayName: null,
          avatar: null,
          isClubMember: true,
          joinedAt: new Date(),
        },
      ];
      // sequential: [0] = baseQuery result (members), [1] = count query result
      const db = buildSequentialDb([memberRows, [{ count: 1 }]]);
      const repo = await buildRepo(db);
      const result = await repo.searchMembers('srv-1', 'ali', undefined, {
        limit: 10,
        offset: 0,
      });
      expect(result.members).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty list when no members match', async () => {
      const db = buildSequentialDb([[], [{ count: 0 }]]);
      const repo = await buildRepo(db);
      const result = await repo.searchMembers('srv-1', 'xyz');
      expect(result.members).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ── upsertMember ────────────────────────────────────────────────────────────

  describe('upsertMember', () => {
    it('inserts and returns the upserted member', async () => {
      const row = { id: 'mem-2', username: 'bob', isClubMember: false };
      const db = buildDb([row]);
      const repo = await buildRepo(db);
      const result = await repo.upsertMember({
        id: 'mem-2',
        username: 'bob',
        isClubMember: false,
        syncedAt: new Date(),
      });
      expect(result).toMatchObject({ id: 'mem-2', username: 'bob' });
    });
  });

  // ── upsertServerMembership ──────────────────────────────────────────────────

  describe('upsertServerMembership', () => {
    it('inserts and returns the membership row', async () => {
      const row = {
        serverId: 'srv-1',
        memberId: 'mem-1',
        joinedAt: new Date(),
      };
      const db = buildDb([row]);
      const repo = await buildRepo(db);
      const result = await repo.upsertServerMembership({
        serverId: 'srv-1',
        memberId: 'mem-1',
      });
      expect(result).toMatchObject({ serverId: 'srv-1', memberId: 'mem-1' });
    });
  });

  // ── replaceMemberRoles ──────────────────────────────────────────────────────

  describe('replaceMemberRoles', () => {
    it('executes transaction to replace roles', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      // Should not throw
      await expect(
        repo.replaceMemberRoles('srv-1', 'mem-1', ['role-1', 'role-2']),
      ).resolves.toBeUndefined();
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── markInactiveForServer ───────────────────────────────────────────────────

  describe('markInactiveForServer', () => {
    it('returns the number of deactivated members and records departures in transaction', async () => {
      const deactivatedRows = [
        { memberId: 'm1' },
        { memberId: 'm2' },
        { memberId: 'm3' },
        { memberId: 'm4' },
      ];
      const db = buildDb([], deactivatedRows);
      const repo = await buildRepo(db);
      const count = await repo.markInactiveForServer('srv-1', new Date());
      expect(count).toBe(4);
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('returns 0 when no members are deactivated', async () => {
      const db = buildDb([], []);
      const repo = await buildRepo(db);
      expect(await repo.markInactiveForServer('srv-1', new Date())).toBe(0);
    });

    it('deletes role links of inactive members inside the transaction', async () => {
      const db = buildDb([], []);
      let txDelete: jest.Mock | undefined;
      const original = db.transaction.getMockImplementation();
      db.transaction.mockImplementation((cb: any) =>
        original((tx: any) => {
          txDelete = tx.delete;
          return cb(tx);
        }),
      );
      const repo = await buildRepo(db);
      await repo.markInactiveForServer('srv-1', new Date());
      expect(txDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeMemberRolesForServer', () => {
    it('deletes the member role links for the server', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await repo.removeMemberRolesForServer('srv-1', 'm1');
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  // ── recordMemberDeparture ───────────────────────────────────────────────────

  describe('recordMemberDeparture', () => {
    it('inserts a departure record', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(
        repo.recordMemberDeparture('srv-1', 'm1', new Date()),
      ).resolves.toBeUndefined();
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  // ── deleteMemberRolesByRoleId ───────────────────────────────────────────────

  describe('deleteMemberRolesByRoleId', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(
        repo.deleteMemberRolesByRoleId('role-5'),
      ).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });
});
