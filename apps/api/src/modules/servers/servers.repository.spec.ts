import { Test } from '@nestjs/testing';
import { ServersRepository } from './servers.repository';
import { DRIZZLE } from '../../database/database.module';

/**
 * Single-result mock — all queries resolve to `finalValue`.
 */
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
      'groupBy',
      'as',
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
  db.transaction = jest.fn().mockImplementation((cb: any) => cb(db));
  return db;
}

/**
 * Sequential mock — each db.select / insert / update / delete call
 * pops the next value from `results`.
 */
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
      'groupBy',
      'as',
    ].forEach((m) => {
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
  db.transaction = jest.fn().mockImplementation((cb: any) => cb(db));
  return db;
}

async function buildRepo(db: any): Promise<ServersRepository> {
  const mod = await Test.createTestingModule({
    providers: [ServersRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(ServersRepository);
}

const fakeServer = (overrides: Record<string, unknown> = {}) => ({
  id: 'srv-1',
  name: 'Main Server',
  icon: null,
  type: 'MAIN',
  isMain: true,
  isActive: true,
  syncFrequencyHours: 24,
  defaultPermissionPolicy: 'DENY',
  disabledReason: null,
  syncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ServersRepository', () => {
  describe('findMain', () => {
    it('returns the main server when found', async () => {
      const server = fakeServer();
      const db = buildDb([server]);
      const repo = await buildRepo(db);
      expect(await repo.findMain()).toEqual(server);
    });

    it('returns null when no main server exists', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findMain()).toBeNull();
    });
  });

  describe('findByName', () => {
    it('returns the server when found', async () => {
      const server = fakeServer({ name: 'Test Guild' });
      const db = buildDb([server]);
      const repo = await buildRepo(db);
      expect(await repo.findByName('Test Guild')).toEqual(server);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByName('Unknown')).toBeNull();
    });
  });

  describe('clearMainServer', () => {
    it('calls update without returning a value', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.clearMainServer(new Date())).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertServer', () => {
    it('inserts / updates and returns the server row', async () => {
      const server = fakeServer();
      const db = buildDb([server]);
      const repo = await buildRepo(db);
      const result = await repo.upsertServer(server as any);
      expect(result).toEqual(server);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('listServersWithLastSync', () => {
    it('returns list of servers with lastSyncAt field', async () => {
      const rows = [{ ...fakeServer(), lastSyncAt: new Date() }];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      const result = await repo.listServersWithLastSync();
      expect(result).toEqual(rows);
      // Two select calls: once for the subquery, once for the main query
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('findById', () => {
    it('returns server when found', async () => {
      const server = fakeServer();
      const db = buildDb([server]);
      const repo = await buildRepo(db);
      expect(await repo.findById('srv-1')).toEqual(server);
    });

    it('returns undefined when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findById('ghost')).toBeUndefined();
    });
  });

  describe('updateById', () => {
    it('returns updated server row', async () => {
      const updated = fakeServer({ name: 'Updated' });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);
      const result = await repo.updateById('srv-1', { name: 'Updated' } as any);
      expect(result).toMatchObject({ name: 'Updated' });
    });
  });

  describe('deleteServerCascade — with roles', () => {
    it('deletes roles, permissions, member-roles, then cascade tables', async () => {
      // Seq: 1=select roles, 2=delete rolePermissions, 3=delete serverMemberRoles,
      //      4=delete projectServers, 5=delete serverSyncLogs,
      //      6=delete serverMembers, 7=delete roles, 8=delete servers
      const db = buildSequentialDb([
        [{ id: 'role-1' }], // select roles → 1 role
        [], // delete rolePermissions
        [], // delete serverMemberRoles
        [], // delete projectServers
        [], // delete serverSyncLogs
        [], // delete serverMembers
        [], // delete roles
        [], // delete servers
      ]);
      const repo = await buildRepo(db);
      await expect(repo.deleteServerCascade('srv-1')).resolves.toBeUndefined();
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(db.delete).toHaveBeenCalledTimes(7);
    });
  });

  describe('deleteServerCascade — no roles', () => {
    it('skips rolePermissions / serverMemberRoles deletes when server has no roles', async () => {
      // Seq: 1=select roles (empty), 2-6=5 cascade deletes
      const db = buildSequentialDb([
        [], // select roles → empty
        [], // delete projectServers
        [], // delete serverSyncLogs
        [], // delete serverMembers
        [], // delete roles
        [], // delete servers
      ]);
      const repo = await buildRepo(db);
      await expect(repo.deleteServerCascade('srv-1')).resolves.toBeUndefined();
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(db.delete).toHaveBeenCalledTimes(5);
    });
  });

  describe('upsertRole', () => {
    it('inserts / updates role and returns the row', async () => {
      const role = {
        id: 'role-1',
        serverId: 'srv-1',
        name: 'Mod',
        color: null,
        hoist: false,
        position: 1,
        managed: false,
        mentionable: false,
        permissionsBits: 0n,
        updatedAt: new Date(),
      };
      const db = buildDb([role]);
      const repo = await buildRepo(db);
      const result = await repo.upsertRole({
        id: 'role-1',
        serverId: 'srv-1',
        name: 'Mod',
        position: 1,
      } as any);
      expect(result).toEqual(role);
    });
  });

  describe('syncRolePermissions', () => {
    it('loads permissions, runs transaction to replace role_permissions', async () => {
      const perms = [
        { id: 'perm-1', bitfield: 4n }, // bit set   → included
        { id: 'perm-2', bitfield: 2n }, // bit unset → excluded
      ];
      const db = buildSequentialDb([perms]); // select permissions → flat perm rows
      // Transaction mock: execute callback with a tx that resolves all ops
      db.transaction = jest.fn().mockImplementation((cb: any) => {
        function makeTxChain(): any {
          const c: any = {};
          ['from', 'where', 'values', 'onConflictDoNothing'].forEach((m) => {
            c[m] = jest.fn().mockReturnValue(c);
          });
          c.returning = jest.fn().mockResolvedValue([]);
          c.then = (r: any) => Promise.resolve([]).then(r);
          return c;
        }
        const tx: any = {
          delete: jest.fn().mockImplementation(makeTxChain),
          insert: jest.fn().mockImplementation(makeTxChain),
        };
        return cb(tx);
      });
      const repo = await buildRepo(db);
      await expect(
        repo.syncRolePermissions('role-1', 4n),
      ).resolves.toBeUndefined();
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteRole', () => {
    it('deletes the role and its referencing rows in one transaction', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.deleteRole('role-1')).resolves.toBeUndefined();
      expect(db.transaction).toHaveBeenCalledTimes(1);
      // rule targets, rules, role_permissions, server_member_roles, roles
      expect(db.delete).toHaveBeenCalledTimes(5);
    });
  });

  describe('findAllActive', () => {
    it('returns active servers', async () => {
      const servers = [fakeServer()];
      const db = buildDb(servers);
      const repo = await buildRepo(db);
      expect(await repo.findAllActive()).toEqual(servers);
    });
  });
});
