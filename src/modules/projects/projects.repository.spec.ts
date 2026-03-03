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
});
