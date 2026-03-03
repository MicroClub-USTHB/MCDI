import { Test } from '@nestjs/testing';
import { ProjectsAccessRepository } from './projects-access.repository';
import { DRIZZLE } from '../../database/database.module';

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
  return db;
}

async function buildRepo(db: any): Promise<ProjectsAccessRepository> {
  const mod = await Test.createTestingModule({
    providers: [ProjectsAccessRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(ProjectsAccessRepository);
}

const fakeMapping = (overrides: Record<string, unknown> = {}) => ({
  projectId: 'proj-1',
  serverId: 'srv-1',
  operations: { read: true, write: false },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ProjectsAccessRepository', () => {
  describe('findProjectById', () => {
    it('returns project row when found', async () => {
      const db = buildDb([{ id: 'proj-1', name: 'Test' }]);
      const repo = await buildRepo(db);
      expect(await repo.findProjectById('proj-1')).toMatchObject({
        id: 'proj-1',
      });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findProjectById('ghost')).toBeNull();
    });
  });

  describe('findServerById', () => {
    it('returns server row when found', async () => {
      const db = buildDb([{ id: 'srv-1', name: 'Main', isActive: true }]);
      const repo = await buildRepo(db);
      expect(await repo.findServerById('srv-1')).toMatchObject({ id: 'srv-1' });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findServerById('ghost')).toBeNull();
    });
  });

  describe('findAccessMapping', () => {
    it('returns mapping row when found', async () => {
      const mapping = fakeMapping();
      const db = buildDb([mapping]);
      const repo = await buildRepo(db);
      expect(await repo.findAccessMapping('proj-1', 'srv-1')).toEqual(mapping);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findAccessMapping('proj-1', 'srv-x')).toBeNull();
    });
  });

  describe('upsertAccessMapping', () => {
    it('inserts or updates and returns the row', async () => {
      const mapping = fakeMapping();
      const db = buildDb([mapping]);
      const repo = await buildRepo(db);
      const now = new Date();
      const result = await repo.upsertAccessMapping(
        'proj-1',
        'srv-1',
        { read: true, write: false } as any,
        now,
      );
      expect(result).toEqual(mapping);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('revokeAccessMapping', () => {
    it('returns deleted row', async () => {
      const mapping = fakeMapping();
      const db = buildDb([mapping]);
      const repo = await buildRepo(db);
      expect(await repo.revokeAccessMapping('proj-1', 'srv-1')).toEqual(
        mapping,
      );
    });

    it('returns null when no row was deleted', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.revokeAccessMapping('proj-1', 'srv-x')).toBeNull();
    });
  });

  describe('insertAuditEntry', () => {
    it('calls insert without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(
        repo.insertAuditEntry({
          projectId: 'proj-1',
          serverId: 'srv-1',
          action: 'GRANT',
          operationsBefore: null,
          operationsAfter: { read: true } as any,
          changedBy: 'admin',
          changedAt: new Date(),
        }),
      ).resolves.toBeUndefined();
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('isOperationAllowed', () => {
    it('returns true when operation is allowed in mapping', async () => {
      const mapping = fakeMapping({ operations: { read: true, write: false } });
      // findAccessMapping is a select call
      const db = buildSequentialDb([[mapping]]);
      const repo = await buildRepo(db);
      expect(
        await repo.isOperationAllowed('proj-1', 'srv-1', 'read' as any),
      ).toBe(true);
    });

    it('returns false when operation is not allowed', async () => {
      const mapping = fakeMapping({ operations: { read: true, write: false } });
      const db = buildSequentialDb([[mapping]]);
      const repo = await buildRepo(db);
      expect(
        await repo.isOperationAllowed('proj-1', 'srv-1', 'write' as any),
      ).toBe(false);
    });

    it('returns false when no mapping exists', async () => {
      const db = buildSequentialDb([[]]);
      const repo = await buildRepo(db);
      expect(
        await repo.isOperationAllowed('proj-1', 'srv-x', 'read' as any),
      ).toBe(false);
    });
  });

  describe('listServersByProject', () => {
    it('returns list of servers for project', async () => {
      const rows = [
        {
          projectId: 'proj-1',
          serverId: 'srv-1',
          serverName: 'Main',
          operations: {},
          updatedAt: new Date(),
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.listServersByProject('proj-1')).toEqual(rows);
    });
  });

  describe('listProjectsByServer', () => {
    it('returns list of projects for server', async () => {
      const rows = [
        {
          serverId: 'srv-1',
          projectId: 'proj-1',
          projectName: 'Test',
          operations: {},
          updatedAt: new Date(),
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.listProjectsByServer('srv-1')).toEqual(rows);
    });
  });

  describe('listAccessMatrix', () => {
    it('returns full access matrix', async () => {
      const rows = [
        {
          projectId: 'proj-1',
          projectName: 'Test',
          serverId: 'srv-1',
          serverName: 'Main',
          operations: {},
          updatedAt: new Date(),
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.listAccessMatrix()).toEqual(rows);
    });
  });

  describe('listAudit', () => {
    it('returns audit entries up to limit', async () => {
      const rows = [
        {
          id: 'audit-1',
          projectId: 'proj-1',
          action: 'GRANT',
          changedAt: new Date(),
        },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.listAudit(10)).toEqual(rows);
    });
  });
});
