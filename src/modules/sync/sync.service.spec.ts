import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncRepository } from './sync.repository';
import { DiscordService } from '../discord/discord.service';
import { ServersRepository } from '../servers/servers.repository';
import { MemberSyncService } from './services/member-sync.service';
import { RoleSyncService } from './services/role-sync.service';
import { ServerSyncService } from './services/server-sync.service';
import { SyncLogService } from './services/sync-log.service';
import { SyncTarget } from './dto/trigger-sync.dto';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSyncRepo = {
  createLog: jest.fn(),
  updateLog: jest.fn(),
  getInProgressLog: jest.fn(),
};

const mockDiscord = {
  getGuildById: jest.fn(),
};

const mockServersRepo = {
  findById: jest.fn(),
  findAllActive: jest.fn(),
};

const mockMemberSyncService = {
  processMember: jest.fn(),
  syncAllMembers: jest.fn(),
  handleMemberAdd: jest.fn(),
  handleMemberRemove: jest.fn(),
  handleMemberUpdate: jest.fn(),
  handleUserUpdate: jest.fn(),
};

const mockRoleSyncService = {
  syncAllRoles: jest.fn(),
  handleRoleCreate: jest.fn(),
  handleRoleUpdate: jest.fn(),
  handleRoleDelete: jest.fn(),
};

const mockServerSyncService = {
  syncServerInfo: jest.fn(),
  prepareGuildCreate: jest.fn(),
  handleGuildDelete: jest.fn(),
  handleGuildUpdate: jest.fn(),
};

const mockSyncLogService = {
  flushChangeBuffer: jest.fn(),
  recordEventChange: jest.fn(),
  getSyncStatus: jest.fn(),
  getAllServersSyncStatus: jest.fn(),
  getSyncLogs: jest.fn(),
  getSyncChangeDetails: jest.fn(),
};

// ── Suite ─────────────────────────────────────────────────────────────────

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: SyncRepository, useValue: mockSyncRepo },
        { provide: DiscordService, useValue: mockDiscord },
        { provide: ServersRepository, useValue: mockServersRepo },
        { provide: MemberSyncService, useValue: mockMemberSyncService },
        { provide: RoleSyncService, useValue: mockRoleSyncService },
        { provide: ServerSyncService, useValue: mockServerSyncService },
        { provide: SyncLogService, useValue: mockSyncLogService },
      ],
    }).compile();
    service = module.get(SyncService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── triggerFullSync ───────────────────────────────────────────────────

  describe('triggerFullSync', () => {
    it('throws NotFoundException when server is not found', async () => {
      mockServersRepo.findById.mockResolvedValue(null);
      await expect(service.triggerFullSync('missing-guild')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when a sync is already in progress', async () => {
      mockServersRepo.findById.mockResolvedValue({ id: 'guild-1' });
      mockSyncRepo.getInProgressLog.mockResolvedValue({ id: 5, status: 'in_progress' });
      await expect(service.triggerFullSync('guild-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a sync log and returns its id when server is found and idle', async () => {
      mockServersRepo.findById.mockResolvedValue({ id: 'guild-1' });
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 42 });
      // runFullSync runs in background — mock discord to exit cleanly
      mockDiscord.getGuildById.mockResolvedValue(null);
      mockSyncRepo.updateLog.mockResolvedValue({});

      const result = await service.triggerFullSync('guild-1');
      expect(result).toEqual({ syncId: 42 });
      expect(mockSyncRepo.createLog).toHaveBeenCalledWith(
        'guild-1',
        'manual',
        'in_progress',
        expect.any(Date),
      );
    });
  });

  // ── triggerMultipleSyncs ──────────────────────────────────────────────

  describe('triggerMultipleSyncs', () => {
    it('returns results for each server, collecting errors gracefully', async () => {
      mockServersRepo.findById
        .mockResolvedValueOnce({ id: 's1' })
        .mockResolvedValueOnce(null);
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 10 });
      mockDiscord.getGuildById.mockResolvedValue(null);
      mockSyncRepo.updateLog.mockResolvedValue({});

      const result = await service.triggerMultipleSyncs(['s1', 's2'], SyncTarget.ALL);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].syncId).toBe(10);
      expect(result.results[1].error).toBeDefined();
    });

    it('syncs all active servers when no ids are provided', async () => {
      mockServersRepo.findAllActive.mockResolvedValue([{ id: 'srv-1' }]);
      mockServersRepo.findById.mockResolvedValue({ id: 'srv-1' });
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 7 });
      mockDiscord.getGuildById.mockResolvedValue(null);
      mockSyncRepo.updateLog.mockResolvedValue({});

      const result = await service.triggerMultipleSyncs([]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].syncId).toBe(7);
    });
  });

  // ── getSyncStatus ─────────────────────────────────────────────────────

  describe('getSyncStatus', () => {
    it('delegates to SyncLogService.getSyncStatus', async () => {
      mockSyncLogService.getSyncStatus.mockResolvedValue(null);
      const result = await service.getSyncStatus('guild-1');
      expect(result).toBeNull();
      expect(mockSyncLogService.getSyncStatus).toHaveBeenCalledWith('guild-1');
    });

    it('returns the dto provided by SyncLogService', async () => {
      const dto = { serverId: 'guild-1', status: 'success', membersSynced: 100, rolesSynced: 5 };
      mockSyncLogService.getSyncStatus.mockResolvedValue(dto);
      const result = await service.getSyncStatus('guild-1');
      expect(result).toBe(dto);
    });
  });

  // ── getSyncChangeDetails ──────────────────────────────────────────────

  describe('getSyncChangeDetails', () => {
    it('delegates to SyncLogService.getSyncChangeDetails', async () => {
      const dto = { total: 1, limit: 100, offset: 0, changes: [] };
      mockSyncLogService.getSyncChangeDetails.mockResolvedValue(dto);
      const result = await service.getSyncChangeDetails(1, 100, 0);
      expect(result).toBe(dto);
      expect(mockSyncLogService.getSyncChangeDetails).toHaveBeenCalledWith(1, 100, 0);
    });
  });

  // ── handleMemberAdd ───────────────────────────────────────────────────

  describe('handleMemberAdd', () => {
    it('delegates to MemberSyncService.handleMemberAdd', async () => {
      const guildMember: any = { id: 'user-1', guild: { id: 'guild-1' } };
      mockMemberSyncService.handleMemberAdd.mockResolvedValue(undefined);
      await service.handleMemberAdd(guildMember);
      expect(mockMemberSyncService.handleMemberAdd).toHaveBeenCalledWith(guildMember);
    });
  });

  // ── handleRoleDelete ──────────────────────────────────────────────────

  describe('handleRoleDelete', () => {
    it('delegates to RoleSyncService.handleRoleDelete', async () => {
      const role: any = { id: 'role-1', guild: { id: 'guild-1' } };
      mockRoleSyncService.handleRoleDelete.mockResolvedValue(undefined);
      await service.handleRoleDelete(role);
      expect(mockRoleSyncService.handleRoleDelete).toHaveBeenCalledWith(role);
    });
  });

  // ── handleGuildCreate ─────────────────────────────────────────────────

  describe('handleGuildCreate', () => {
    it('starts a full sync when prepareGuildCreate returns shouldSync=true', async () => {
      const guild: any = { id: 'guild-1', name: 'Test' };
      mockServerSyncService.prepareGuildCreate.mockResolvedValue({ shouldSync: true, logId: 55 });
      mockDiscord.getGuildById.mockResolvedValue(null);
      mockSyncRepo.updateLog.mockResolvedValue({});

      await service.handleGuildCreate(guild);
      expect(mockServerSyncService.prepareGuildCreate).toHaveBeenCalledWith(guild);
    });

    it('does not start a sync when prepareGuildCreate returns shouldSync=false', async () => {
      const guild: any = { id: 'guild-1', name: 'Test' };
      mockServerSyncService.prepareGuildCreate.mockResolvedValue({ shouldSync: false, logId: undefined });

      await service.handleGuildCreate(guild);
      expect(mockDiscord.getGuildById).not.toHaveBeenCalled();
    });
  });

  // ── handleGuildDelete ─────────────────────────────────────────────────

  describe('handleGuildDelete', () => {
    it('delegates to ServerSyncService.handleGuildDelete', async () => {
      const guild: any = { id: 'guild-1' };
      mockServerSyncService.handleGuildDelete.mockResolvedValue(undefined);
      await service.handleGuildDelete(guild);
      expect(mockServerSyncService.handleGuildDelete).toHaveBeenCalledWith(guild);
    });
  });
});
