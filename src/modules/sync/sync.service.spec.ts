import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncRepository } from './sync.repository';
import { DiscordService } from '../discord/discord.service';
import { MemberRepository } from '../members/member.repository';
import { ServersRepository } from '../servers/servers.repository';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSyncRepo = {
  createLog: jest.fn(),
  updateLog: jest.fn(),
  getInProgressLog: jest.fn(),
  getLatestLog: jest.fn(),
  getLogs: jest.fn(),
  countLogs: jest.fn(),
  createChangeDetail: jest.fn(),
  createChangeDetails: jest.fn(),
  getChangeDetails: jest.fn(),
  countChangeDetails: jest.fn(),
};

const mockDiscord = {
  getGuildById: jest.fn(),
};

const mockMemberRepo = {
  upsertMember: jest.fn(),
  upsertServerMembership: jest.fn(),
  replaceMemberRoles: jest.fn(),
  markInactiveForServer: jest.fn(),
  deleteMemberRolesByRoleId: jest.fn(),
};

const mockServersRepo = {
  findById: jest.fn(),
  findAllActive: jest.fn(),
  upsertRole: jest.fn(),
  syncRolePermissions: jest.fn(),
  deleteRole: jest.fn(),
  updateById: jest.fn(),
  upsertServer: jest.fn(),
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
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: ServersRepository, useValue: mockServersRepo },
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
      mockSyncRepo.getInProgressLog.mockResolvedValue({
        id: 5,
        status: 'in_progress',
      });
      await expect(service.triggerFullSync('guild-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a sync log and returns its id when server is found and idle', async () => {
      mockServersRepo.findById.mockResolvedValue({ id: 'guild-1' });
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 42 });
      // runFullSync runs in background — mock discord so it exits cleanly
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

  // ── getSyncStatus ─────────────────────────────────────────────────────

  describe('getSyncStatus', () => {
    it('returns null when no sync log exists for the server', async () => {
      mockSyncRepo.getLatestLog.mockResolvedValue(null);
      const result = await service.getSyncStatus('guild-1');
      expect(result).toBeNull();
    });

    it('returns mapped SyncStatusDto when a log exists', async () => {
      const now = new Date();
      mockSyncRepo.getLatestLog.mockResolvedValue({
        serverId: 'guild-1',
        status: 'success',
        membersSynced: 100,
        rolesSynced: 20,
        message: null,
        startedAt: now,
        finishedAt: now,
      });
      const result = await service.getSyncStatus('guild-1');
      expect(result!.serverId).toBe('guild-1');
      expect(result!.status).toBe('success');
      expect(result!.membersSynced).toBe(100);
    });
  });

  // ── getSyncChangeDetails ──────────────────────────────────────────────

  describe('getSyncChangeDetails', () => {
    it('returns mapped change details with pagination metadata', async () => {
      const now = new Date();
      mockSyncRepo.getChangeDetails.mockResolvedValue([
        {
          id: 1,
          syncLogId: 1,
          serverId: 'g1',
          entityType: 'member',
          entityId: 'u1',
          action: 'added',
          description: 'joined',
          details: null,
          createdAt: now,
        },
      ]);
      mockSyncRepo.countChangeDetails.mockResolvedValue(1);

      const result = await service.getSyncChangeDetails(1, 100, 0);
      expect(result.total).toBe(1);
      expect(result.changes[0].action).toBe('added');
      expect(result.changes[0].createdAt).toBe(now.toISOString());
    });
  });

  // ── handleMemberAdd ───────────────────────────────────────────────────

  describe('handleMemberAdd', () => {
    it('records an event change detail after processing the member', async () => {
      const guildMember: any = {
        id: 'user-1',
        guild: { id: 'guild-1' },
        user: {
          id: 'user-1',
          username: 'alice',
          globalName: null,
          avatarURL: () => null,
        },
        nickname: null,
        joinedAt: new Date(),
        roles: { cache: { keys: () => [], size: 0 } },
      };

      mockMemberRepo.upsertMember.mockResolvedValue(undefined);
      mockMemberRepo.upsertServerMembership.mockResolvedValue(undefined);
      mockMemberRepo.replaceMemberRoles.mockResolvedValue(undefined);
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 99 });
      mockSyncRepo.updateLog.mockResolvedValue({});
      mockSyncRepo.createChangeDetail.mockResolvedValue({});

      await expect(service.handleMemberAdd(guildMember)).resolves.not.toThrow();
    });
  });

  // ── handleRoleDelete ──────────────────────────────────────────────────

  describe('handleRoleDelete', () => {
    it('deletes member role assignments and the role itself', async () => {
      const role: any = {
        id: 'role-1',
        name: 'Test Role',
        guild: { id: 'guild-1' },
      };
      mockMemberRepo.deleteMemberRolesByRoleId.mockResolvedValue(undefined);
      mockServersRepo.deleteRole.mockResolvedValue(undefined);
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 99 });
      mockSyncRepo.updateLog.mockResolvedValue({});
      mockSyncRepo.createChangeDetail.mockResolvedValue({});

      await service.handleRoleDelete(role);
      expect(mockMemberRepo.deleteMemberRolesByRoleId).toHaveBeenCalledWith(
        'role-1',
      );
      expect(mockServersRepo.deleteRole).toHaveBeenCalledWith('role-1');
    });
  });
});
