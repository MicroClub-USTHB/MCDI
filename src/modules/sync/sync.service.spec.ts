import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncRepository } from './sync.repository';
import { DiscordService } from '../discord/discord.service';
import { MemberRepository } from '../members/member.repository';
import { ServersRepository } from '../servers/servers.repository';
import { SyncTarget } from './dto/trigger-sync.dto';

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

    it('updates sync log as failed when guild is not found in background sync', async () => {
      mockServersRepo.findById.mockResolvedValue({ id: 'guild-1' });
      mockSyncRepo.getInProgressLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 77 });
      mockDiscord.getGuildById.mockResolvedValue(null);
      mockSyncRepo.updateLog.mockResolvedValue({});

      await service.triggerFullSync('guild-1');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockSyncRepo.updateLog).toHaveBeenCalledWith(
        77,
        expect.objectContaining({
          status: 'failed',
          message: 'Guild not found or bot not in server',
        }),
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

  describe('runFullSync internals', () => {
    it('marks sync as failed when role upsert retries are exhausted', async () => {
      jest.useFakeTimers();
      mockDiscord.getGuildById.mockResolvedValue({
        id: 'guild-1',
        name: 'Guild',
        iconURL: () => null,
        roles: {
          fetch: jest.fn().mockResolvedValue(
            new Map([
              [
                'role-1',
                {
                  id: 'role-1',
                  name: 'Role',
                  color: 0,
                  hoist: false,
                  position: 1,
                  managed: false,
                  mentionable: false,
                  permissions: { bitfield: BigInt(0) },
                },
              ],
            ]),
          ),
        },
        members: {
          fetch: jest.fn().mockResolvedValue({ size: 0, last: () => null }),
        },
      } as any);
      mockServersRepo.updateById.mockResolvedValue({});
      mockServersRepo.upsertRole.mockRejectedValue(new Error('db down'));
      mockSyncRepo.updateLog.mockResolvedValue({});
      mockSyncRepo.createChangeDetails.mockResolvedValue(undefined);

      const promise = (service as any).runFullSync(
        'guild-1',
        20,
        SyncTarget.ALL,
      );
      await jest.advanceTimersByTimeAsync(4000);
      await promise;

      expect(mockServersRepo.upsertRole).toHaveBeenCalledTimes(3);
      expect(mockSyncRepo.updateLog).toHaveBeenCalledWith(
        20,
        expect.objectContaining({
          status: 'failed',
          message: 'db down',
        }),
      );
      jest.useRealTimers();
    });

    it('handles multi-page member fetch using the after cursor', async () => {
      const emptyRoleCache = new Map<string, { id: string }>();
      const firstPageMember = {
        id: 'member-1',
        user: { username: 'alice' },
        roles: { cache: emptyRoleCache },
      };
      const secondPageMember = {
        id: 'member-2',
        user: { username: 'bob' },
        roles: { cache: emptyRoleCache },
      };

      const firstPage = {
        size: 1000,
        last: () => ({ id: 'member-1' }),
        [Symbol.iterator]: function* () {
          yield ['member-1', firstPageMember];
        },
      };
      const secondPage = {
        size: 1,
        last: () => ({ id: 'member-2' }),
        [Symbol.iterator]: function* () {
          yield ['member-2', secondPageMember];
        },
      };

      const membersFetch = jest
        .fn()
        .mockResolvedValueOnce(firstPage as any)
        .mockResolvedValueOnce(secondPage as any);
      mockDiscord.getGuildById.mockResolvedValue({
        id: 'guild-1',
        name: 'Guild',
        iconURL: () => null,
        roles: {
          fetch: jest.fn().mockResolvedValue(new Map()),
        },
        members: { fetch: membersFetch },
      } as any);
      mockServersRepo.updateById.mockResolvedValue({});
      mockMemberRepo.markInactiveForServer.mockResolvedValue(0);
      mockSyncRepo.updateLog.mockResolvedValue({});
      mockSyncRepo.createChangeDetails.mockResolvedValue(undefined);

      const processSpy = jest
        .spyOn(service, 'processMember')
        .mockResolvedValue(undefined);

      await (service as any).runFullSync('guild-1', 21, SyncTarget.MEMBERS);

      expect(membersFetch).toHaveBeenNthCalledWith(1, { limit: 1000 });
      expect(membersFetch).toHaveBeenNthCalledWith(2, {
        limit: 1000,
        after: 'member-1',
      });
      expect(processSpy).toHaveBeenCalledTimes(2);
      expect(mockSyncRepo.updateLog).toHaveBeenCalledWith(
        21,
        expect.objectContaining({
          status: 'success',
          membersSynced: 2,
        }),
      );
    });
  });

  describe('handleRoleCreate retries', () => {
    it('retries syncRolePermissions and succeeds on a subsequent attempt', async () => {
      jest.useFakeTimers();
      const role: any = {
        id: 'role-1',
        name: 'Lead',
        color: 0,
        hoist: false,
        position: 1,
        managed: false,
        mentionable: false,
        permissions: { bitfield: BigInt(8) },
        guild: { id: 'guild-1' },
      };
      mockServersRepo.upsertRole.mockResolvedValue(undefined);
      mockServersRepo.syncRolePermissions
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValue(undefined);
      mockSyncRepo.createLog.mockResolvedValue({ id: 88 });
      mockSyncRepo.updateLog.mockResolvedValue({});
      mockSyncRepo.createChangeDetail.mockResolvedValue({});

      const promise = service.handleRoleCreate(role);
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockServersRepo.syncRolePermissions).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });
});
