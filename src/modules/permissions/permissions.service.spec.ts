import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsRepository } from './permissions.repository';
import { PermissionCacheService } from './permission-cache.service';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRepo = {
  findPermissionIdByName: jest.fn(),
  hasGlobalRolePermission: jest.fn(),
  hasServerPermission: jest.fn(),
  hasHierarchyPermission: jest.fn(),
  hasInheritedPermission: jest.fn(),
  hasPermissionAnySource: jest.fn(),
  hasPermissionExcludingRole: jest.fn(),
  listGlobalPermissionNames: jest.fn(),
  listServerPermissionNames: jest.fn(),
  listHierarchyPermissionNames: jest.fn(),
  listInheritedPermissionNames: jest.fn(),
  upsertInheritanceRule: jest.fn(),
  listInheritanceRules: jest.fn(),
  getMainServerId: jest.fn(),
  getRoleServerId: jest.fn(),
  findMissingServerIds: jest.fn(),
  getRoleWithServer: jest.fn(),
  getPermissionsByRole: jest.fn(),
  addPermissionsToRole: jest.fn(),
  removePermissionFromRole: jest.fn(),
  getMembersByRole: jest.fn(),
  getMinHierarchyLevelInServer: jest.fn(),
  findExistingPermissionIds: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  invalidateServer: jest.fn(),
};

const CHECK_DTO = {
  discordId: 'user-1',
  serverId: 'guild-1',
  permission: 'read_members',
};

// ── Suite ──────────────────────────────────────────────────────────────────

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PermissionsRepository, useValue: mockRepo },
        { provide: PermissionCacheService, useValue: mockCache },
      ],
    }).compile();
    service = module.get(PermissionsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── checkPermission ─────────────────────────────────────────────────────

  describe('checkPermission', () => {
    it('throws BadRequestException when required fields are missing', async () => {
      await expect(
        service.checkPermission({
          discordId: '',
          serverId: '',
          permission: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns cached result when entry is in cache', async () => {
      mockCache.get.mockReturnValue({ permissions: ['READ_MEMBERS'] });

      const result = await service.checkPermission(CHECK_DTO);
      expect(result.source).toBe('cached');
      expect(mockRepo.findPermissionIdByName).not.toHaveBeenCalled();
    });

    it('returns allowed=true for ADMINISTRATOR in cache (bypass)', async () => {
      mockCache.get.mockReturnValue({ permissions: ['ADMINISTRATOR'] });

      const result = await service.checkPermission(CHECK_DTO);
      expect(result.allowed).toBe(true);
      expect(result.source).toBe('cached');
    });

    it('returns allowed=false from cache when permission not present', async () => {
      mockCache.get.mockReturnValue({ permissions: ['OTHER_PERM'] });

      const result = await service.checkPermission({
        ...CHECK_DTO,
        permission: 'MANAGE_WEBHOOKS',
      });
      expect(result.allowed).toBe(false);
    });

    it('falls back to DB when cache misses — returns allowed via global role', async () => {
      mockCache.get.mockReturnValue(null);
      mockRepo.findPermissionIdByName
        .mockResolvedValueOnce(5) // requested permission id
        .mockResolvedValueOnce(1); // ADMINISTRATOR id
      mockRepo.hasGlobalRolePermission
        .mockResolvedValueOnce(false) // admin check
        .mockResolvedValueOnce(true); // actual permission check

      const result = await service.checkPermission(CHECK_DTO);
      expect(result.allowed).toBe(true);
      expect(result.source).toBe('global');
    });

    it('returns allowed=false when none of the 4 layers grant the permission', async () => {
      mockCache.get.mockReturnValue(null);
      mockRepo.findPermissionIdByName.mockResolvedValue(5);
      mockRepo.hasGlobalRolePermission.mockResolvedValue(false);
      mockRepo.hasServerPermission.mockResolvedValue(false);
      mockRepo.hasHierarchyPermission.mockResolvedValue(false);
      mockRepo.hasInheritedPermission.mockResolvedValue(false);

      const result = await service.checkPermission(CHECK_DTO);
      expect(result.allowed).toBe(false);
    });

    it('grants ADMINISTRATOR bypass via server layer', async () => {
      mockCache.get.mockReturnValue(null);
      mockRepo.findPermissionIdByName
        .mockResolvedValueOnce(5) // requested perm
        .mockResolvedValueOnce(1); // ADMINISTRATOR
      mockRepo.hasGlobalRolePermission.mockResolvedValue(false); // not global admin
      mockRepo.hasServerPermission.mockResolvedValue(true); // IS server admin

      const result = await service.checkPermission(CHECK_DTO);
      expect(result.allowed).toBe(true);
      expect(result.source).toBe('server');
    });

    it('grants ADMINISTRATOR bypass via hierarchy layer', async () => {
      mockCache.get.mockReturnValue(null);
      mockRepo.findPermissionIdByName
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1);
      mockRepo.hasGlobalRolePermission.mockResolvedValue(false);
      mockRepo.hasServerPermission.mockResolvedValue(false);
      mockRepo.hasHierarchyPermission.mockResolvedValue(true);

      const result = await service.checkPermission(CHECK_DTO);
      expect(result.allowed).toBe(true);
      expect(result.source).toBe('hierarchy');
    });
  });

  // ── getMemberPermissions ────────────────────────────────────────────────

  describe('getMemberPermissions', () => {
    it('returns all 4 source buckets', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['MANAGE_WEBHOOKS']);
      mockRepo.listServerPermissionNames.mockResolvedValue(['READ_MEMBERS']);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([
        'SEND_MESSAGES',
      ]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.getMemberPermissions('guild-1', 'user-1');

      expect(result.sources.global).toEqual(['MANAGE_WEBHOOKS']);
      expect(result.sources.server).toEqual(['READ_MEMBERS']);
      expect(result.sources.hierarchy).toEqual(['SEND_MESSAGES']);
      expect(result.sources.inherited).toEqual([]);
      expect(result.permissions).toContain('MANAGE_WEBHOOKS');
      expect(result.permissions).toContain('READ_MEMBERS');
    });

    it('deduplicates permissions present in multiple sources', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['READ']);
      mockRepo.listServerPermissionNames.mockResolvedValue(['READ']);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue(['READ']);
      mockRepo.listInheritedPermissionNames.mockResolvedValue(['READ']);

      const result = await service.getMemberPermissions('guild-1', 'user-1');
      const count = result.permissions.filter((p) => p === 'READ').length;
      expect(count).toBe(1);
    });

    it('throws BadRequestException when discordId is empty', async () => {
      await expect(service.getMemberPermissions('guild-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when serverId is empty', async () => {
      await expect(service.getMemberPermissions('', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns cached result on cache hit', async () => {
      const cached = {
        permissions: ['READ_MEMBERS'],
        sources: {
          global: ['READ_MEMBERS'],
          server: [],
          hierarchy: [],
          inherited: [],
        },
      };
      mockCache.get.mockReturnValue(cached);

      const result = await service.getMemberPermissions('guild-1', 'user-1');
      expect(result).toMatchObject(cached);
      expect(mockRepo.listGlobalPermissionNames).not.toHaveBeenCalled();
    });

    it('sets cache after DB lookup', async () => {
      mockCache.get.mockReturnValue(null);
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['PERM_A']);
      mockRepo.listServerPermissionNames.mockResolvedValue([]);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      await service.getMemberPermissions('guild-1', 'user-1');
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  // ── upsertInheritanceRule ───────────────────────────────────────────────

  describe('upsertInheritanceRule', () => {
    const baseDto = {
      sourceRoleId: 'role-1',
      targetScope: 'all' as const,
      enabled: true,
    };

    it('throws BadRequestException when sourceRoleId is empty', async () => {
      await expect(
        service.upsertInheritanceRule({ ...baseDto, sourceRoleId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no main server is configured', async () => {
      mockRepo.getMainServerId.mockResolvedValue(null);
      await expect(service.upsertInheritanceRule(baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when sourceRoleId does not exist', async () => {
      mockRepo.getMainServerId.mockResolvedValue('main-guild');
      mockRepo.getRoleServerId.mockResolvedValue(null);

      await expect(service.upsertInheritanceRule(baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when role belongs to a different server', async () => {
      mockRepo.getMainServerId.mockResolvedValue('main-guild');
      mockRepo.getRoleServerId.mockResolvedValue('other-guild');

      await expect(service.upsertInheritanceRule(baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when targetScope=selected with no targetServerIds', async () => {
      mockRepo.getMainServerId.mockResolvedValue('main-guild');
      mockRepo.getRoleServerId.mockResolvedValue('main-guild');

      await expect(
        service.upsertInheritanceRule({
          ...baseDto,
          targetScope: 'selected',
          targetServerIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when targetServerIds contains unknown server IDs', async () => {
      mockRepo.getMainServerId.mockResolvedValue('main-guild');
      mockRepo.getRoleServerId.mockResolvedValue('main-guild');
      mockRepo.findMissingServerIds.mockResolvedValue(['unknown-server']);

      await expect(
        service.upsertInheritanceRule({
          ...baseDto,
          targetScope: 'selected',
          targetServerIds: ['unknown-server'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns rule on success with targetScope=all', async () => {
      const fakeRule = {
        id: 'rule-1',
        sourceRoleId: 'role-1',
        targetScope: 'all',
      };
      mockRepo.getMainServerId.mockResolvedValue('main-guild');
      mockRepo.getRoleServerId.mockResolvedValue('main-guild');
      mockRepo.upsertInheritanceRule.mockResolvedValue(fakeRule);

      const result = await service.upsertInheritanceRule(baseDto);
      expect(result).toMatchObject({ rule: fakeRule });
    });

    it('returns rule on success with targetScope=selected and valid server IDs', async () => {
      const fakeRule = {
        id: 'rule-2',
        sourceRoleId: 'role-1',
        targetScope: 'selected',
      };
      mockRepo.getMainServerId.mockResolvedValue('main-guild');
      mockRepo.getRoleServerId.mockResolvedValue('main-guild');
      mockRepo.findMissingServerIds.mockResolvedValue([]);
      mockRepo.upsertInheritanceRule.mockResolvedValue(fakeRule);

      const result = await service.upsertInheritanceRule({
        ...baseDto,
        targetScope: 'selected',
        targetServerIds: ['server-a'],
      });
      expect(result).toMatchObject({ rule: fakeRule });
    });
  });

  // ── listInheritanceRules ────────────────────────────────────────────────

  describe('listInheritanceRules', () => {
    it('delegates to the repository and returns rules', async () => {
      const fakeRules = [{ id: 'r1' }, { id: 'r2' }];
      mockRepo.listInheritanceRules.mockResolvedValue(fakeRules);

      const result = await service.listInheritanceRules();
      expect(result).toEqual(fakeRules);
      expect(mockRepo.listInheritanceRules).toHaveBeenCalledTimes(1);
    });
  });

  // ── hasAllPermissions ───────────────────────────────────────────────────

  describe('hasAllPermissions', () => {
    beforeEach(() => {
      mockCache.get.mockReturnValue(null);
    });

    it('returns allowed=true (ADMINISTRATOR bypass) even when other perms are missing', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['ADMINISTRATOR']);
      mockRepo.listServerPermissionNames.mockResolvedValue([]);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.hasAllPermissions('guild-1', 'user-1', [
        'READ_MEMBERS',
        'MANAGE_WEBHOOKS',
      ]);
      expect(result).toMatchObject({ allowed: true, missing: [] });
    });

    it('returns allowed=true when all requested permissions are present', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['READ_MEMBERS']);
      mockRepo.listServerPermissionNames.mockResolvedValue(['MANAGE_WEBHOOKS']);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.hasAllPermissions('guild-1', 'user-1', [
        'READ_MEMBERS',
        'MANAGE_WEBHOOKS',
      ]);
      expect(result).toMatchObject({ allowed: true, missing: [] });
    });

    it('returns allowed=false with missing list when some permissions are absent', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['READ_MEMBERS']);
      mockRepo.listServerPermissionNames.mockResolvedValue([]);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.hasAllPermissions('guild-1', 'user-1', [
        'READ_MEMBERS',
        'MANAGE_WEBHOOKS',
      ]);
      expect(result.allowed).toBe(false);
      expect(result.missing).toContain('MANAGE_WEBHOOKS');
    });
  });

  // ── hasAnyPermission ────────────────────────────────────────────────────

  describe('hasAnyPermission', () => {
    beforeEach(() => {
      mockCache.get.mockReturnValue(null);
    });

    it('returns allowed=true (ADMINISTRATOR bypass) with all requested perms as matched', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['ADMINISTRATOR']);
      mockRepo.listServerPermissionNames.mockResolvedValue([]);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.hasAnyPermission('guild-1', 'user-1', [
        'READ_MEMBERS',
        'MANAGE_WEBHOOKS',
      ]);
      expect(result.allowed).toBe(true);
    });

    it('returns allowed=true when at least one permission matches', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['READ_MEMBERS']);
      mockRepo.listServerPermissionNames.mockResolvedValue([]);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.hasAnyPermission('guild-1', 'user-1', [
        'READ_MEMBERS',
        'MANAGE_WEBHOOKS',
      ]);
      expect(result.allowed).toBe(true);
      expect(result.matched).toContain('READ_MEMBERS');
    });

    it('returns allowed=false with empty matched when no permissions match', async () => {
      mockRepo.listGlobalPermissionNames.mockResolvedValue(['OTHER_PERM']);
      mockRepo.listServerPermissionNames.mockResolvedValue([]);
      mockRepo.listHierarchyPermissionNames.mockResolvedValue([]);
      mockRepo.listInheritedPermissionNames.mockResolvedValue([]);

      const result = await service.hasAnyPermission('guild-1', 'user-1', [
        'READ_MEMBERS',
        'MANAGE_WEBHOOKS',
      ]);
      expect(result.allowed).toBe(false);
      expect(result.matched).toEqual([]);
    });
  });

  // ── getRolePermissions ────────────────────────────────────────────────

  describe('getRolePermissions', () => {
    it('throws BadRequestException when serverId is empty', async () => {
      await expect(service.getRolePermissions('', 'role-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when roleId is empty', async () => {
      await expect(service.getRolePermissions('guild-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when role not found', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(null);
      await expect(
        service.getRolePermissions('guild-1', 'role-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when role belongs to different server', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-other',
        name: 'Admin',
        isGlobal: false,
        hierarchyLevel: 2,
      });
      await expect(
        service.getRolePermissions('guild-1', 'role-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns role permissions on success', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-1',
        name: 'Admin',
        isGlobal: false,
        hierarchyLevel: 2,
      });
      mockRepo.getPermissionsByRole.mockResolvedValue([
        { id: 1, key: 'READ_MEMBERS', description: 'Read members' },
        { id: 2, key: 'SEND_MESSAGES', description: null },
      ]);

      const result = await service.getRolePermissions('guild-1', 'role-1');
      expect(result.roleId).toBe('role-1');
      expect(result.roleName).toBe('Admin');
      expect(result.serverId).toBe('guild-1');
      expect(result.permissions).toHaveLength(2);
      expect(result.permissions[0].key).toBe('READ_MEMBERS');
    });
  });

  // ── assignPermissionsToRole ───────────────────────────────────────────

  describe('assignPermissionsToRole', () => {
    it('throws BadRequestException when permissionIds is empty', async () => {
      await expect(
        service.assignPermissionsToRole('guild-1', 'role-1', {
          permissionIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when role not found', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(null);
      await expect(
        service.assignPermissionsToRole('guild-1', 'role-1', {
          permissionIds: [1, 2],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when some permission IDs do not exist', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-1',
        name: 'Admin',
        isGlobal: false,
        hierarchyLevel: 2,
      });
      mockRepo.findExistingPermissionIds.mockResolvedValue([1]);

      await expect(
        service.assignPermissionsToRole('guild-1', 'role-1', {
          permissionIds: [1, 999],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns permissions and invalidates cache on success', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-1',
        name: 'Admin',
        isGlobal: false,
        hierarchyLevel: 2,
      });
      mockRepo.findExistingPermissionIds.mockResolvedValue([1, 2]);
      mockRepo.addPermissionsToRole.mockResolvedValue(undefined);
      mockRepo.getPermissionsByRole.mockResolvedValue([
        { id: 1, key: 'READ_MEMBERS', description: 'Read members' },
      ]);

      const result = await service.assignPermissionsToRole(
        'guild-1',
        'role-1',
        { permissionIds: [1, 2] },
      );

      expect(mockRepo.addPermissionsToRole).toHaveBeenCalledWith(
        'role-1',
        [1, 2],
      );
      expect(mockCache.invalidateServer).toHaveBeenCalledWith('guild-1');
      expect(result.permissions).toHaveLength(1);
    });
  });

  // ── removePermissionFromRole ──────────────────────────────────────────

  describe('removePermissionFromRole', () => {
    it('throws BadRequestException when serverId is empty', async () => {
      await expect(
        service.removePermissionFromRole('', 'role-1', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when role not found', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(null);
      await expect(
        service.removePermissionFromRole('guild-1', 'role-1', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when role is global', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-1',
        name: 'Executive',
        isGlobal: true,
        hierarchyLevel: 1,
      });

      await expect(
        service.removePermissionFromRole('guild-1', 'role-1', 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when role has highest rank (min hierarchyLevel)', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-1',
        name: 'Lead',
        isGlobal: false,
        hierarchyLevel: 1,
      });
      mockRepo.getMinHierarchyLevelInServer.mockResolvedValue(1);

      await expect(
        service.removePermissionFromRole('guild-1', 'role-1', 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('removes permission and invalidates cache on success', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue({
        id: 'role-1',
        serverId: 'guild-1',
        name: 'Member',
        isGlobal: false,
        hierarchyLevel: 5,
      });
      mockRepo.getMinHierarchyLevelInServer.mockResolvedValue(1);
      mockRepo.removePermissionFromRole.mockResolvedValue(undefined);

      await service.removePermissionFromRole('guild-1', 'role-1', 3);

      expect(mockRepo.removePermissionFromRole).toHaveBeenCalledWith(
        'role-1',
        3,
      );
      expect(mockCache.invalidateServer).toHaveBeenCalledWith('guild-1');
    });
  });

  // ── previewImpact ─────────────────────────────────────────────────────

  describe('previewImpact', () => {
    const roleData = {
      id: 'role-1',
      serverId: 'guild-1',
      name: 'Member',
      isGlobal: false,
      hierarchyLevel: 3,
    };

    it('throws BadRequestException when serverId is empty', async () => {
      await expect(
        service.previewImpact('', 'role-1', {
          permissionIds: [1],
          action: 'add',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when role not found', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(null);
      await expect(
        service.previewImpact('guild-1', 'role-1', {
          permissionIds: [1],
          action: 'add',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('filters out permission IDs already on the role for action add', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(roleData);
      mockRepo.getPermissionsByRole.mockResolvedValue([
        { id: 1, key: 'READ', description: null },
      ]);
      mockRepo.getMembersByRole.mockResolvedValue(['member-1']);

      const result = await service.previewImpact('guild-1', 'role-1', {
        permissionIds: [1],
        action: 'add',
      });

      // perm 1 is already on the role, so nothing to add → 0 affected
      expect(result.affectedMembers).toBe(0);
      expect(result.memberIds).toEqual([]);
      expect(result.roleHolders).toBe(1);
    });

    it('filters out permission IDs not on the role for action remove', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(roleData);
      mockRepo.getPermissionsByRole.mockResolvedValue([
        { id: 1, key: 'READ', description: null },
      ]);
      mockRepo.getMembersByRole.mockResolvedValue(['member-1']);

      const result = await service.previewImpact('guild-1', 'role-1', {
        permissionIds: [2],
        action: 'remove',
      });

      // perm 2 is NOT on the role, so nothing to remove → 0 affected
      expect(result.affectedMembers).toBe(0);
      expect(result.memberIds).toEqual([]);
      expect(result.roleHolders).toBe(1);
    });

    it('returns affected members who would gain permissions on add', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(roleData);
      mockRepo.getPermissionsByRole.mockResolvedValue([]);
      mockRepo.getMembersByRole.mockResolvedValue([
        'member-1',
        'member-2',
        'member-3',
      ]);

      // member-1 already has perm 1, member-2 and member-3 don't
      mockRepo.hasPermissionAnySource.mockImplementation(
        async (memberId: string) => {
          if (memberId === 'member-1') return true;
          return false;
        },
      );

      const result = await service.previewImpact('guild-1', 'role-1', {
        permissionIds: [1],
        action: 'add',
      });

      expect(result.affectedMembers).toBe(2);
      expect(result.memberIds).toEqual(['member-2', 'member-3']);
      expect(result.roleHolders).toBe(3);
    });

    it('returns affected members who would lose permissions on remove', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(roleData);
      mockRepo.getPermissionsByRole.mockResolvedValue([
        { id: 1, key: 'READ', description: null },
      ]);
      mockRepo.getMembersByRole.mockResolvedValue([
        'member-1',
        'member-2',
      ]);

      // member-1 has perm 1 only through this role
      // member-2 has perm 1 through another source too
      mockRepo.hasPermissionAnySource.mockResolvedValue(true);
      mockRepo.hasPermissionExcludingRole.mockImplementation(
        async (_mid: string, _sid: string, _pid: number, _rid: string) => {
          if (_mid === 'member-2') return true;
          return false;
        },
      );

      const result = await service.previewImpact('guild-1', 'role-1', {
        permissionIds: [1],
        action: 'remove',
      });

      expect(result.affectedMembers).toBe(1);
      expect(result.memberIds).toEqual(['member-1']);
      expect(result.roleHolders).toBe(2);
    });

    it('returns zero counts when no members hold the role', async () => {
      mockRepo.getRoleWithServer.mockResolvedValue(roleData);
      mockRepo.getPermissionsByRole.mockResolvedValue([]);
      mockRepo.getMembersByRole.mockResolvedValue([]);

      const result = await service.previewImpact('guild-1', 'role-1', {
        permissionIds: [1],
        action: 'add',
      });

      expect(result.affectedMembers).toBe(0);
      expect(result.memberIds).toEqual([]);
      expect(result.roleHolders).toBe(0);
    });
  });
});
