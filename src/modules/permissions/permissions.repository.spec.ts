import { Test } from '@nestjs/testing';
import { PermissionsRepository } from './permissions.repository';
import { DRIZZLE } from '../../database/database.module';

// ── Mock helpers ────────────────────────────────────────────────────────────
//
// db itself is NOT thenable. Each db.select() call returns a fresh thenable
// chain. This avoids the NestJS DI thenable-resolution bug while allowing:
//   - queries ending with .limit(n)  → thenable terminal
//   - queries ending with .where()   → thenable terminal
//   - queries using .returning()     → explicit Promise terminal

function makeChain(finalValue: unknown = []): any {
  const chain: any = {};
  const methods = [
    'from',
    'where',
    'orderBy',
    'innerJoin',
    'leftJoin',
    'groupBy',
    'having',
    'set',
    'limit',
    'offset',
    'values',
    'onConflictDoUpdate',
  ];
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.returning = jest.fn().mockResolvedValue(finalValue);
  chain.execute = jest.fn().mockResolvedValue(finalValue);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(finalValue).then(resolve, reject);
  return chain;
}

/** Single-result db: every select/insert/update/delete returns the same finalValue. */
function buildDb(finalValue: unknown = []) {
  const makeTxChain = () => makeChain(finalValue);
  const db: any = {
    select: jest.fn().mockImplementation(() => makeChain(finalValue)),
    insert: jest.fn().mockImplementation(() => makeChain(finalValue)),
    update: jest.fn().mockImplementation(() => makeChain(finalValue)),
    delete: jest.fn().mockImplementation(() => makeChain(finalValue)),
    // transaction: calls cb with a mini-tx that returns finalValue for any query
    transaction: jest
      .fn()
      .mockImplementation((cb: (tx: any) => Promise<unknown>) => {
        const tx: any = {
          select: jest.fn().mockImplementation(makeTxChain),
          insert: jest.fn().mockImplementation(makeTxChain),
          update: jest.fn().mockImplementation(makeTxChain),
          delete: jest.fn().mockImplementation(makeTxChain),
        };
        return cb(tx);
      }),
  };
  return db;
}

/** Sequential db: each db.select() call returns the next result from the list. */
function buildSequentialDb(results: unknown[][]) {
  let idx = 0;
  const nextResult = () => results[idx++] ?? [];
  const db: any = {
    select: jest.fn().mockImplementation(() => makeChain(nextResult())),
    insert: jest.fn().mockImplementation(() => makeChain(nextResult())),
    update: jest.fn().mockImplementation(() => makeChain(nextResult())),
    delete: jest.fn().mockImplementation(() => makeChain(nextResult())),
    transaction: jest
      .fn()
      .mockImplementation((cb: (tx: any) => Promise<unknown>) => {
        const tx: any = {
          select: jest.fn().mockImplementation(() => makeChain(nextResult())),
          insert: jest.fn().mockImplementation(() => makeChain(nextResult())),
          update: jest.fn().mockImplementation(() => makeChain(nextResult())),
          delete: jest.fn().mockImplementation(() => makeChain(nextResult())),
        };
        return cb(tx);
      }),
  };
  return db;
}

async function buildRepo(db: any): Promise<PermissionsRepository> {
  const module = await Test.createTestingModule({
    providers: [PermissionsRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return module.get(PermissionsRepository);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PermissionsRepository', () => {
  // ── findPermissionIdByName ─────────────────────────────────────────────

  describe('findPermissionIdByName', () => {
    it('returns the permission id when found', async () => {
      const db = buildDb([{ id: 42 }]);
      const repo = await buildRepo(db);
      const result = await repo.findPermissionIdByName('READ_MEMBERS');
      expect(result).toBe(42);
    });

    it('returns null when permission is not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.findPermissionIdByName('UNKNOWN');
      expect(result).toBeNull();
    });
  });

  // ── hasGlobalRolePermission ────────────────────────────────────────────

  describe('hasGlobalRolePermission', () => {
    it('returns true when member has global role with the permission', async () => {
      const db = buildDb([{ roleId: 'role-1' }]);
      const repo = await buildRepo(db);
      expect(await repo.hasGlobalRolePermission('member-1', 5)).toBe(true);
    });

    it('returns false when no global role grants the permission', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.hasGlobalRolePermission('member-1', 5)).toBe(false);
    });
  });

  // ── hasServerPermission ────────────────────────────────────────────────

  describe('hasServerPermission', () => {
    it('returns true when member has a server-scoped role with the permission', async () => {
      const db = buildDb([{ roleId: 'role-2' }]);
      const repo = await buildRepo(db);
      expect(await repo.hasServerPermission('member-1', 'guild-1', 3)).toBe(
        true,
      );
    });

    it('returns false when member lacks the server-scoped permission', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.hasServerPermission('member-1', 'guild-1', 3)).toBe(
        false,
      );
    });
  });

  // ── hasHierarchyPermission ─────────────────────────────────────────────

  describe('hasHierarchyPermission', () => {
    it('returns true when hierarchy grants the permission', async () => {
      // Query 1: get member roles with hierarchyLevel (thenable terminal, no .limit())
      // Query 2: find role with that permission via .limit(1)
      const db = buildSequentialDb([
        [{ hierarchyLevel: 5 }], // member has a role at hierarchyLevel 5
        [{ roleId: 'role-3' }], // a role at level >= 5 has the permission
      ]);
      const repo = await buildRepo(db);
      expect(await repo.hasHierarchyPermission('member-1', 'guild-1', 7)).toBe(
        true,
      );
    });

    it('returns false when hierarchy does not grant the permission', async () => {
      // Query 1: member has no roles with hierarchyLevel → empty → return false early
      const db = buildSequentialDb([
        [], // memberRoles empty → early return false
      ]);
      const repo = await buildRepo(db);
      expect(await repo.hasHierarchyPermission('member-1', 'guild-1', 7)).toBe(
        false,
      );
    });
  });

  // ── hasInheritedPermission ─────────────────────────────────────────────

  describe('hasInheritedPermission', () => {
    it('returns true when cross-server inheritance grants the permission', async () => {
      // Query 1 (getMainServerId): returns guild-main
      // Query 2 (inheritedRoleRows): member holds 'Executive' in main server
      // Query 3 (targetRolePermissionRows): target server has role 'Executive' with permission
      const db = buildSequentialDb([
        [{ id: 'guild-main' }], // getMainServerId
        [{ roleName: 'Executive' }], // inheritedRoleRows
        [{ roleName: 'Executive' }], // targetRolePermissionRows
      ]);
      const repo = await buildRepo(db);
      expect(await repo.hasInheritedPermission('member-1', 'guild-2', 7)).toBe(
        true,
      );
    });

    it('returns false when no inheritance rule applies', async () => {
      // serverId === mainServerId → early return false (no further queries needed)
      const db = buildSequentialDb([
        [{ id: 'guild-main' }], // getMainServerId returns 'guild-main'
      ]);
      const repo = await buildRepo(db);
      // Calling with serverId = mainServerId triggers early return
      expect(
        await repo.hasInheritedPermission('member-1', 'guild-main', 7),
      ).toBe(false);
    });
  });

  // ── listGlobalPermissionNames ──────────────────────────────────────────

  describe('listGlobalPermissionNames', () => {
    it('returns deduplicated global permission names for a member', async () => {
      // Query ends with .where() (thenable terminal, no .limit())
      const db = buildDb([
        { name: 'READ_MEMBERS' },
        { name: 'SEND_MESSAGES' },
        { name: 'READ_MEMBERS' },
      ]);
      const repo = await buildRepo(db);
      const result = await repo.listGlobalPermissionNames('member-1');
      expect(Array.isArray(result)).toBe(true);
      // Deduplicated: READ_MEMBERS appears twice but output should have it once
      expect(result).toContain('READ_MEMBERS');
      expect(result).toContain('SEND_MESSAGES');
      expect(result).toHaveLength(2);
    });
  });

  // ── upsertInheritanceRule ──────────────────────────────────────────────

  describe('upsertInheritanceRule', () => {
    it('calls insert/update without throwing', async () => {
      // Transaction sequence (targetScope='all', no targetServerIds):
      //   1. tx.select()...limit(1)  → [] (no existing rule → INSERT path)
      //   2. tx.insert()...returning → [{id: 1}] (new rule id)
      //   3. tx.delete()...where()   → [] (clear existing targets)
      const db = buildSequentialDb([
        [], // tx.select: no existing rule
        [{ id: 1 }], // tx.insert.returning: ruleId = 1
        [], // tx.delete.where: clear targets (no-op for 'all' scope)
      ]);
      const repo = await buildRepo(db);

      await expect(
        repo.upsertInheritanceRule({
          sourceRoleId: 'role-1',
          targetScope: 'all',
          enabled: true,
          targetServerIds: [],
          now: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });
});
