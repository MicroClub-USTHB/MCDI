import { Test } from '@nestjs/testing';
import { ProjectRepository } from './project.repository';
import { DRIZZLE } from '../../../database/database.module';
import * as apiKeyUtil from '../../../common/utils/api-key.util';

jest.mock('../../../common/utils/api-key.util');
const mockVerifyApiKey = apiKeyUtil.verifyApiKey as jest.MockedFunction<
  typeof apiKeyUtil.verifyApiKey
>;

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

async function buildRepo(db: any): Promise<ProjectRepository> {
  const mod = await Test.createTestingModule({
    providers: [ProjectRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(ProjectRepository);
}

const fakeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'proj-1',
  name: 'Test Project',
  description: null,
  apiKeyHash: '$argon2id$v=19$m=65536$hash',
  apiKeyPrefix: 'pfx',
  apiKeyCreatedAt: new Date(),
  apiKeyLastUsedAt: null,
  isActive: true,
  redirectUri: 'https://app.example.com/cb',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ProjectRepository (auth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByApiKey', () => {
    it('returns project when key is valid', async () => {
      const project = fakeProject();
      mockVerifyApiKey.mockReturnValue(true);
      const db = buildDb([project]);
      const repo = await buildRepo(db);
      const result = await repo.findByApiKey('pfx.secret123');
      expect(result).toEqual(project);
      expect(mockVerifyApiKey).toHaveBeenCalledWith(
        'secret123',
        project.apiKeyHash,
      );
    });

    it('returns null when secret does not match', async () => {
      const project = fakeProject();
      mockVerifyApiKey.mockReturnValue(false);
      const db = buildDb([project]);
      const repo = await buildRepo(db);
      expect(await repo.findByApiKey('pfx.wrongsecret')).toBeNull();
    });

    it('returns null for invalid key format (no dot)', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByApiKey('invalidkey')).toBeNull();
      expect(db.select).not.toHaveBeenCalled();
    });

    it('returns null when project not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByApiKey('pfx.secret')).toBeNull();
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

  describe('findMainServer', () => {
    it('returns main server when found', async () => {
      const srv = { id: 'srv-1', name: 'Main', isMain: true };
      const db = buildDb([srv]);
      const repo = await buildRepo(db);
      expect(await repo.findMainServer()).toEqual(srv);
    });

    it('returns null when no main server', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findMainServer()).toBeNull();
    });
  });

  describe('isMemberInServer', () => {
    it('returns true when membership row exists', async () => {
      const db = buildDb([{ memberId: 'mem-1', serverId: 'srv-1' }]);
      const repo = await buildRepo(db);
      expect(await repo.isMemberInServer('mem-1', 'srv-1')).toBe(true);
    });

    it('returns false when no row', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.isMemberInServer('mem-1', 'srv-2')).toBe(false);
    });
  });

  describe('getMemberRolesInServer', () => {
    it('returns role rows', async () => {
      const rows = [
        { roleId: 'role-1', roleName: 'Mod', roleColor: 0, rolePosition: 2 },
      ];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      expect(await repo.getMemberRolesInServer('mem-1', 'srv-1')).toEqual(rows);
    });
  });

  describe('memberHasAnyRole', () => {
    it('returns true immediately when roleIds is empty (no restriction)', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.memberHasAnyRole('mem-1', [])).toBe(true);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('returns true when member holds at least one role', async () => {
      const db = buildDb([{ memberId: 'mem-1', roleId: 'role-1' }]);
      const repo = await buildRepo(db);
      expect(await repo.memberHasAnyRole('mem-1', ['role-1'])).toBe(true);
    });

    it('returns false when member holds none of the required roles', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.memberHasAnyRole('mem-1', ['role-x'])).toBe(false);
    });
  });

  describe('findServerByName', () => {
    it('returns server when found', async () => {
      const srv = { id: 'srv-1', name: 'Main' };
      const db = buildDb([srv]);
      const repo = await buildRepo(db);
      expect(await repo.findServerByName('Main')).toEqual(srv);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findServerByName('Ghost')).toBeNull();
    });
  });

  describe('hasServerAccess', () => {
    it('returns true when access row exists', async () => {
      const db = buildDb([{ projectId: 'proj-1', serverId: 'srv-1' }]);
      const repo = await buildRepo(db);
      expect(await repo.hasServerAccess('proj-1', 'srv-1')).toBe(true);
    });

    it('returns false when no row', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.hasServerAccess('proj-1', 'srv-2')).toBe(false);
    });
  });

  describe('isRedirectUriAllowed', () => {
    it('returns true when URI is in the project list', async () => {
      const db = buildDb([
        { redirectUri: 'https://a.com/cb, https://b.com/cb' },
      ]);
      const repo = await buildRepo(db);
      expect(
        await repo.isRedirectUriAllowed('proj-1', 'https://a.com/cb'),
      ).toBe(true);
    });

    it('returns false when URI is not in the list', async () => {
      const db = buildDb([{ redirectUri: 'https://a.com/cb' }]);
      const repo = await buildRepo(db);
      expect(
        await repo.isRedirectUriAllowed('proj-1', 'https://evil.com/cb'),
      ).toBe(false);
    });

    it('returns false when project has no redirectUri', async () => {
      const db = buildDb([{ redirectUri: null }]);
      const repo = await buildRepo(db);
      expect(
        await repo.isRedirectUriAllowed('proj-1', 'https://a.com/cb'),
      ).toBe(false);
    });
  });

  describe('syncMemberServerData', () => {
    it('inserts server member row and role data without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(
        repo.syncMemberServerData('mem-1', 'srv-1', [
          { id: 'role-1', name: 'Mod', color: 0, position: 1 },
        ]),
      ).resolves.toBeUndefined();
      expect(db.insert).toHaveBeenCalledTimes(3);
    });

    it('skips role inserts when discordRoles is empty', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await repo.syncMemberServerData('mem-1', 'srv-1', []);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('regenerateApiKey', () => {
    it('returns updated project', async () => {
      const project = fakeProject({ apiKeyPrefix: 'new-pfx' });
      const db = buildDb([project]);
      const repo = await buildRepo(db);
      const result = await repo.regenerateApiKey(
        'proj-1',
        'new-hash',
        'new-pfx',
      );
      expect(result).toMatchObject({ apiKeyPrefix: 'new-pfx' });
    });

    it('returns null when project not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.regenerateApiKey('ghost', 'h', 'p')).toBeNull();
    });
  });
});
