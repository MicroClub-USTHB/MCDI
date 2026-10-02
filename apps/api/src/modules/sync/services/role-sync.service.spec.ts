import { Test, TestingModule } from '@nestjs/testing';
import { RoleSyncService } from './role-sync.service';
import { ServersRepository } from '../../servers/servers.repository';
import { MemberRepository } from '../../members/member.repository';
import { SyncLogService } from './sync-log.service';
import { PermissionCacheService } from '../../permissions/permission-cache.service';

const mockServersRepo = {
  upsertRole: jest.fn(),
  syncRolePermissions: jest.fn(),
  deleteRole: jest.fn(),
};

const mockMemberRepo = {
  deleteMemberRolesByRoleId: jest.fn(),
};

const mockSyncLog = {
  recordEventChange: jest.fn(),
};

const mockPermissionCache = {
  invalidateServer: jest.fn(),
  clear: jest.fn(),
};

// Mirrors discord.js: `role.guild.roles.cache` holds every role in the guild,
// so hierarchy level can be derived from the max `position`. Pass `siblings` to
// control that set; it defaults to just the role itself.
const makeRole = (overrides: Partial<any> = {}, siblings?: any[]): any => {
  const role: any = {
    id: 'role-1',
    name: 'Moderator',
    color: 0,
    hoist: false,
    position: 1,
    managed: false,
    mentionable: true,
    permissions: { bitfield: BigInt(0) },
    ...overrides,
  };
  role.guild = {
    id: 'guild-1',
    roles: { cache: new Map((siblings ?? [role]).map((r) => [r.id, r])) },
  };
  return role;
};

describe('RoleSyncService', () => {
  let service: RoleSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleSyncService,
        { provide: ServersRepository, useValue: mockServersRepo },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: SyncLogService, useValue: mockSyncLog },
        { provide: PermissionCacheService, useValue: mockPermissionCache },
      ],
    }).compile();
    service = module.get(RoleSyncService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── handleRoleCreate ──────────────────────────────────────────────────

  describe('handleRoleCreate', () => {
    it('upserts the role, syncs permissions, and records the event', async () => {
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);
      mockSyncLog.recordEventChange.mockResolvedValue(undefined);

      await service.handleRoleCreate(makeRole());
      expect(mockPermissionCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
      expect(mockServersRepo.upsertRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-1', name: 'Moderator' }),
      );
      expect(mockServersRepo.syncRolePermissions).toHaveBeenCalledWith(
        'role-1',
        BigInt(0),
      );
      expect(mockSyncLog.recordEventChange).toHaveBeenCalledWith(
        'guild-1',
        'role',
        'role-1',
        'added',
        expect.stringContaining('Moderator'),
      );
    });
  });

  // ── handleRoleUpdate ──────────────────────────────────────────────────

  describe('handleRoleUpdate', () => {
    it('upserts the role and records an updated event', async () => {
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);
      mockSyncLog.recordEventChange.mockResolvedValue(undefined);

      await service.handleRoleUpdate(makeRole({ name: 'Admin' }));
      expect(mockPermissionCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
      expect(mockSyncLog.recordEventChange).toHaveBeenCalledWith(
        'guild-1',
        'role',
        'role-1',
        'updated',
        expect.stringContaining('Admin'),
      );
    });
  });

  // ── handleRoleDelete ──────────────────────────────────────────────────

  describe('handleRoleDelete', () => {
    it('deletes the role, flushes the cache, then records the event', async () => {
      mockServersRepo.deleteRole.mockResolvedValue(undefined);
      mockSyncLog.recordEventChange.mockResolvedValue(undefined);

      await service.handleRoleDelete(makeRole());
      expect(mockPermissionCache.clear).toHaveBeenCalled();
      expect(mockServersRepo.deleteRole).toHaveBeenCalledWith('role-1');
      expect(mockSyncLog.recordEventChange).toHaveBeenCalledWith(
        'guild-1',
        'role',
        'role-1',
        'removed',
        expect.stringContaining('Moderator'),
      );
    });
  });

  // ── syncAllRoles ──────────────────────────────────────────────────────

  describe('syncAllRoles', () => {
    it('upserts each role and returns the count', async () => {
      const role = makeRole();
      const guild: any = {
        id: 'guild-1',
        roles: {
          fetch: jest.fn().mockResolvedValue(new Map([['role-1', role]])),
        },
      };
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);

      const buffer: any[] = [];
      const result = await service.syncAllRoles(guild, 1, buffer);

      expect(result.rolesSynced).toBe(1);
      expect(mockPermissionCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
      expect(mockServersRepo.upsertRole).toHaveBeenCalledTimes(1);
      expect(buffer).toHaveLength(1);
      expect(buffer[0].entityType).toBe('role');
    });

    it('derives hierarchyLevel from position (top role → level 1)', async () => {
      // Discord positions: @everyone = 0, highest role = max position.
      const everyone = { id: 'r-everyone', position: 0 };
      const mid = { id: 'r-mid', position: 4 };
      const top = { id: 'r-top', position: 9 };
      const roles = new Map<string, any>([
        ['r-everyone', makeRole({ id: 'r-everyone', position: 0 })],
        ['r-mid', makeRole({ id: 'r-mid', position: 4 })],
        ['r-top', makeRole({ id: 'r-top', position: 9 })],
      ]);
      const guild: any = {
        id: 'guild-1',
        roles: { fetch: jest.fn().mockResolvedValue(roles) },
      };
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);

      await service.syncAllRoles(guild, 1, []);

      const levelById = Object.fromEntries(
        mockServersRepo.upsertRole.mock.calls.map(([arg]) => [
          arg.id,
          arg.hierarchyLevel,
        ]),
      );
      // level = maxPosition - position + 1, maxPosition = 9
      expect(levelById[top.id]).toBe(1);
      expect(levelById[mid.id]).toBe(6);
      expect(levelById[everyone.id]).toBe(10);
    });
  });

  describe('hierarchyLevel on real-time events', () => {
    it('handleRoleCreate derives level from the guild role cache', async () => {
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);
      mockSyncLog.recordEventChange.mockResolvedValue(undefined);

      const created = makeRole({ id: 'r-new', position: 3 });
      const siblings = [
        makeRole({ id: 'r-everyone', position: 0 }),
        created,
        makeRole({ id: 'r-top', position: 7 }),
      ];
      const role = makeRole({ id: 'r-new', position: 3 }, siblings);

      await service.handleRoleCreate(role);

      expect(mockServersRepo.upsertRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r-new', hierarchyLevel: 5 }), // 7 - 3 + 1
      );
    });

    it('handleRoleUpdate recomputes level when position changes', async () => {
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);
      mockSyncLog.recordEventChange.mockResolvedValue(undefined);

      const moved = makeRole({ id: 'r-moved', position: 6 });
      const siblings = [makeRole({ id: 'r-everyone', position: 0 }), moved];
      const role = makeRole({ id: 'r-moved', position: 6 }, siblings);

      await service.handleRoleUpdate(role);

      expect(mockServersRepo.upsertRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r-moved', hierarchyLevel: 1 }), // 6 - 6 + 1
      );
    });
  });
});
