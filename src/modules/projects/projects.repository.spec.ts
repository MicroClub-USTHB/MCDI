import { Test } from '@nestjs/testing';
import { ProjectsRepository } from './projects.repository';
import { DRIZZLE } from '../../database/database.module';

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
  const db: any = {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  };
  return db;
}

function buildDb(finalValue: unknown = []) {
  return buildSequentialDb([finalValue]);
}

async function buildRepo(db: any): Promise<ProjectsRepository> {
  const mod = await Test.createTestingModule({
    providers: [ProjectsRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(ProjectsRepository);
}

const fakeProjectRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'proj-1',
  name: 'Test Project',
  description: null,
  apiKeyPrefix: 'pfx',
  apiKeyCreatedAt: new Date(),
  apiKeyLastUsedAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ProjectsRepository', () => {
  describe('create', () => {
    it('inserts project and scopes, returns ProjectRow', async () => {
      const row = fakeProjectRow();
      // 1st call: insert project (returning [row])
      // 2nd call: insert scopes (returning [] — but values() is awaited via chain.then → [])
      const db = buildSequentialDb([[row], []]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        name: 'Test Project',
        apiKeyHash: 'h',
        apiKeyPrefix: 'pfx',
        scopes: ['read:members'],
      });
      expect(result).toMatchObject({
        name: 'Test Project',
        scopes: ['read:members'],
      });
    });

    it('works when no scopes provided', async () => {
      const row = fakeProjectRow();
      const db = buildSequentialDb([[row]]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        name: 'Test Project',
        apiKeyHash: 'h',
        apiKeyPrefix: 'pfx',
        scopes: [],
      });
      expect(result).toMatchObject({ scopes: [] });
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns projects with merged scopes', async () => {
      const projectRows = [fakeProjectRow()];
      const scopeRows = [{ projectId: 'proj-1', scope: 'read:members' }];
      // select projects → projectRows; select scopes (getScopeMap) → scopeRows
      const db = buildSequentialDb([projectRows, scopeRows]);
      const repo = await buildRepo(db);
      const results = await repo.findAll();
      expect(results).toHaveLength(1);
      expect(results[0].scopes).toContain('read:members');
    });

    it('returns empty list when no projects', async () => {
      const db = buildSequentialDb([[]]);
      const repo = await buildRepo(db);
      const results = await repo.findAll();
      expect(results).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns project with scopes when found', async () => {
      const row = fakeProjectRow();
      const scopes = [{ scope: 'read:members' }];
      const db = buildSequentialDb([[row], scopes]);
      const repo = await buildRepo(db);
      const result = await repo.findOne('proj-1');
      expect(result).not.toBeNull();
      expect(result!.scopes).toContain('read:members');
    });

    it('returns null when not found', async () => {
      const db = buildSequentialDb([[]]);
      const repo = await buildRepo(db);
      expect(await repo.findOne('ghost')).toBeNull();
    });
  });

  describe('update', () => {
    it('returns updated project with scopes', async () => {
      const updated = fakeProjectRow({ name: 'Renamed' });
      const scopes = [{ scope: 'write:members' }];
      const db = buildSequentialDb([[updated], scopes]);
      const repo = await buildRepo(db);
      const result = await repo.update('proj-1', { name: 'Renamed' });
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Renamed');
    });

    it('returns null when not found', async () => {
      const db = buildSequentialDb([[]]);
      const repo = await buildRepo(db);
      expect(await repo.update('ghost', { name: 'x' })).toBeNull();
    });
  });

  describe('replaceScopes', () => {
    it('deletes existing scopes and inserts new ones', async () => {
      const db = buildSequentialDb([[], []]);
      const repo = await buildRepo(db);
      await expect(
        repo.replaceScopes('proj-1', ['read:members']),
      ).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('only deletes when scopes array is empty', async () => {
      const db = buildSequentialDb([[]]);
      const repo = await buildRepo(db);
      await repo.replaceScopes('proj-1', []);
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('updateKey', () => {
    it('calls update without returning a value', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(
        repo.updateKey('proj-1', 'new-hash', 'new-pfx'),
      ).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('setActive', () => {
    it('calls update without returning a value', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.setActive('proj-1', false)).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('returns true when row is deleted', async () => {
      const db = buildDb([{ id: 'proj-1' }]);
      const repo = await buildRepo(db);
      expect(await repo.delete('proj-1')).toBe(true);
    });

    it('returns false when project not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.delete('ghost')).toBe(false);
    });
  });

  // ── Auth-support queries ──────────────────────────────────────────────

  describe('isRedirectUriAllowed', () => {
    it('returns true when URI is in the comma-separated list', async () => {
      const db = buildSequentialDb([
        [{ redirectUri: 'https://a.com/cb, https://b.com/cb' }],
      ]);
      const repo = await buildRepo(db);
      expect(
        await repo.isRedirectUriAllowed('proj-1', 'https://a.com/cb'),
      ).toBe(true);
    });

    it('returns false when URI is not in the list', async () => {
      const db = buildSequentialDb([[{ redirectUri: 'https://a.com/cb' }]]);
      const repo = await buildRepo(db);
      expect(
        await repo.isRedirectUriAllowed('proj-1', 'https://evil.com/cb'),
      ).toBe(false);
    });

    it('returns false when project has no redirectUri', async () => {
      const db = buildSequentialDb([[{ redirectUri: null }]]);
      const repo = await buildRepo(db);
      expect(
        await repo.isRedirectUriAllowed('proj-1', 'https://a.com/cb'),
      ).toBe(false);
    });
  });

  describe('findAllowedRoleIds', () => {
    it('returns array of role IDs', async () => {
      const db = buildDb([{ roleId: 'role-1' }, { roleId: 'role-2' }]);
      const repo = await buildRepo(db);
      expect(await repo.findAllowedRoleIds('proj-1')).toEqual([
        'role-1',
        'role-2',
      ]);
    });

    it('returns empty array when no roles configured', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findAllowedRoleIds('proj-1')).toEqual([]);
    });
  });

  describe('findAllowedRoles', () => {
    it('returns rows with role details', async () => {
      const row = {
        roleId: 'role-1',
        roleName: 'Admin',
        roleColor: 0xff0000,
        rolePosition: 1,
      };
      const db = buildDb([row]);
      const repo = await buildRepo(db);
      expect(await repo.findAllowedRoles('proj-1')).toEqual([row]);
    });
  });

  describe('regenerateApiKey', () => {
    it('returns updated project', async () => {
      const updated = fakeProjectRow({ apiKeyPrefix: 'new-pfx' });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);
      const result = await repo.regenerateApiKey('proj-1', 'new-hash', 'new-pfx');
      expect(result).toMatchObject({ apiKeyPrefix: 'new-pfx' });
    });

    it('returns null when project not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.regenerateApiKey('ghost', 'h', 'p')).toBeNull();
    });
  });

  // ── Project-Server Access methods ───────────────────────────────────

  const fakeMapping = (overrides: Record<string, unknown> = {}) => ({
    projectId: 'proj-1',
    serverId: 'srv-1',
    operations: { read: true, write: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('findProjectById', () => {
    it('returns project row when found', async () => {
      const db = buildDb([{ id: 'proj-1', name: 'Test' }]);
      const repo = await buildRepo(db);
      expect(await repo.findProjectById('proj-1')).toMatchObject({ id: 'proj-1' });
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
      expect(await repo.revokeAccessMapping('proj-1', 'srv-1')).toEqual(mapping);
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
        { id: 'audit-1', projectId: 'proj-1', action: 'GRANT', changedAt: new Date() },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.listAudit(10)).toEqual(rows);
    });
  });

  describe('hasServerAccess', () => {
    it('returns true when access mapping exists', async () => {
      const db = buildDb([fakeMapping()]);
      const repo = await buildRepo(db);
      expect(await repo.hasServerAccess('proj-1', 'srv-1')).toBe(true);
    });

    it('returns false when no mapping found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.hasServerAccess('proj-1', 'srv-x')).toBe(false);
    });
  });
});
