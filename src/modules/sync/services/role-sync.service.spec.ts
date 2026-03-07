import { Test, TestingModule } from '@nestjs/testing';
import { RoleSyncService } from './role-sync.service';
import { ServersRepository } from '../../servers/servers.repository';
import { MemberRepository } from '../../members/member.repository';
import { SyncLogService } from './sync-log.service';

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

const makeRole = (overrides: Partial<any> = {}): any => ({
  id: 'role-1',
  name: 'Moderator',
  guild: { id: 'guild-1' },
  color: 0,
  hoist: false,
  position: 1,
  managed: false,
  mentionable: true,
  permissions: { bitfield: BigInt(0) },
  ...overrides,
});

describe('RoleSyncService', () => {
  let service: RoleSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleSyncService,
        { provide: ServersRepository, useValue: mockServersRepo },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: SyncLogService, useValue: mockSyncLog },
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
      expect(mockServersRepo.upsertRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-1', name: 'Moderator' }),
      );
      expect(mockServersRepo.syncRolePermissions).toHaveBeenCalledWith('role-1', BigInt(0));
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
    it('deletes member role assignments and the role, then records the event', async () => {
      mockMemberRepo.deleteMemberRolesByRoleId.mockResolvedValue(undefined);
      mockServersRepo.deleteRole.mockResolvedValue(undefined);
      mockSyncLog.recordEventChange.mockResolvedValue(undefined);

      await service.handleRoleDelete(makeRole());
      expect(mockMemberRepo.deleteMemberRolesByRoleId).toHaveBeenCalledWith('role-1');
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
        roles: { fetch: jest.fn().mockResolvedValue(new Map([['role-1', role]])) },
      };
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions.mockResolvedValue(undefined);

      const buffer: any[] = [];
      const result = await service.syncAllRoles(guild, 1, buffer);

      expect(result.rolesSynced).toBe(1);
      expect(mockServersRepo.upsertRole).toHaveBeenCalledTimes(1);
      expect(buffer).toHaveLength(1);
      expect(buffer[0].entityType).toBe('role');
    });
  });
});
