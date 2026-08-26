import { Test } from '@nestjs/testing';
import { AdminMembersRepository } from './admin-members.repository';
import { DRIZZLE } from '../../database/database.module';

// ── Mock factory ─────────────────────────────────────────────────────────────
// db must NOT be thenable (NestJS DI resolves thenables as Promises).
// selectDistinct is used by buildMemberConditions subquery.

function buildDb(finalValue: unknown = []) {
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
      'having',
      'as',
      'execute',
    ];
    methods.forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }
  const db: any = {
    select: jest.fn().mockImplementation(makeChain),
    selectDistinct: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  };
  return db;
}

async function buildRepo(db: any): Promise<AdminMembersRepository> {
  const mod = await Test.createTestingModule({
    providers: [AdminMembersRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(AdminMembersRepository);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminMembersRepository', () => {
  // ── findMemberById ──────────────────────────────────────────────────────────

  describe('findMemberById', () => {
    it('returns mapped member when found', async () => {
      const row = {
        id: 'mem-1',
        username: 'alice',
        globalName: 'Alice',
        displayName: 'Alice',
        avatar: null,
        isClubMember: true,
        syncedAt: new Date(),
      };
      const db = buildDb([row]);
      const repo = await buildRepo(db);
      const result = await repo.findMemberById('mem-1');
      expect(result).toMatchObject({ id: 'mem-1', username: 'alice' });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findMemberById('ghost')).toBeNull();
    });
  });

  // ── findMembershipsByMemberId ───────────────────────────────────────────────

  describe('findMembershipsByMemberId', () => {
    it('returns array of memberships', async () => {
      const rows = [
        {
          memberId: 'mem-1',
          serverId: 'srv-1',
          joinedAt: new Date(),
          serverName: 'Main',
          serverIcon: null,
          isMainServer: true,
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.findMembershipsByMemberId('mem-1')).toEqual(rows);
    });

    it('returns empty array when no memberships', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findMembershipsByMemberId('ghost')).toEqual([]);
    });
  });

  // ── findRolesByMemberId ─────────────────────────────────────────────────────

  describe('findRolesByMemberId', () => {
    it('returns roles for a member', async () => {
      const rows = [
        {
          roleId: 'role-1',
          roleName: 'Lead',
          roleColor: 0xff0000,
          rolePosition: 2,
          serverId: 'srv-1',
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.findRolesByMemberId('mem-1')).toEqual(rows);
    });
  });

  // ── countMembers ────────────────────────────────────────────────────────────

  describe('countMembers', () => {
    it('returns count for filter=all', async () => {
      // countMembers makes ONE outer select; the subquery is built inline (not awaited)
      const db = buildDb([{ count: 7 }]);
      const repo = await buildRepo(db);
      expect(await repo.countMembers('all')).toBe(7);
    });

    it('returns count for filter=club with search', async () => {
      const db = buildDb([{ count: 3 }]);
      const repo = await buildRepo(db);
      expect(await repo.countMembers('club', 'ali')).toBe(3);
    });

    it('returns count when filtered by serverId and roleId', async () => {
      const db = buildDb([{ count: 2 }]);
      const repo = await buildRepo(db);
      expect(await repo.countMembers('all', undefined, ['srv-1'], ['role-1'])).toBe(
        2,
      );
    });
  });

  // ── findMembersPaginated ────────────────────────────────────────────────────

  describe('findMembersPaginated', () => {
    it('returns paginated members', async () => {
      const rows = [
        { id: 'mem-1', username: 'alice', globalName: null, avatar: null },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      const result = await repo.findMembersPaginated('all', undefined, 10, 0);
      expect(result).toEqual(rows);
    });

    it('applies search and club filter', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.findMembersPaginated('club', 'bob', 5, 10);
      expect(result).toEqual([]);
    });

    it('applies serverId and roleId filters', async () => {
      const rows = [
        { id: 'mem-1', username: 'alice', globalName: null, avatar: null },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      const result = await repo.findMembersPaginated(
        'all',
        undefined,
        10,
        0,
        ['srv-1'],
        ['role-1'],
      );
      expect(result).toEqual(rows);
    });
  });

  // ── findMembershipsByMemberIds ──────────────────────────────────────────────

  describe('findMembershipsByMemberIds', () => {
    it('returns batch memberships', async () => {
      const rows = [
        {
          memberId: 'mem-1',
          serverId: 'srv-1',
          joinedAt: new Date(),
          serverName: 'Main',
          isMainServer: true,
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.findMembershipsByMemberIds(['mem-1'])).toEqual(rows);
    });
  });

  // ── findRoleNamesByMemberIds ────────────────────────────────────────────────

  describe('findRoleNamesByMemberIds', () => {
    it('returns batch role names', async () => {
      const rows = [{ memberId: 'mem-1', serverId: 'srv-1', roleName: 'Lead' }];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.findRoleNamesByMemberIds(['mem-1'])).toEqual(rows);
    });
  });
});
