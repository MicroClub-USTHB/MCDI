import { Test, TestingModule } from '@nestjs/testing';
import { SyncLogService } from './sync-log.service';
import { SyncRepository } from '../sync.repository';
import { ServersRepository } from '../../servers/servers.repository';

const mockSyncRepo = {
  createLog: jest.fn(),
  updateLog: jest.fn(),
  getLatestLog: jest.fn(),
  getLogs: jest.fn(),
  countLogs: jest.fn(),
  createChangeDetail: jest.fn(),
  createChangeDetails: jest.fn(),
  getChangeDetails: jest.fn(),
  countChangeDetails: jest.fn(),
};

const mockServersRepo = {
  findAllActive: jest.fn(),
};

describe('SyncLogService', () => {
  let service: SyncLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncLogService,
        { provide: SyncRepository, useValue: mockSyncRepo },
        { provide: ServersRepository, useValue: mockServersRepo },
      ],
    }).compile();
    service = module.get(SyncLogService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getSyncStatus ─────────────────────────────────────────────────────

  describe('getSyncStatus', () => {
    it('returns null when no log exists', async () => {
      mockSyncRepo.getLatestLog.mockResolvedValue(null);
      expect(await service.getSyncStatus('guild-1')).toBeNull();
    });

    it('maps a log row to SyncStatusDto', async () => {
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
      expect(result!.startedAt).toBe(now.toISOString());
    });
  });

  // ── getSyncLogs ───────────────────────────────────────────────────────

  describe('getSyncLogs', () => {
    it('returns paginated log list with correct total', async () => {
      const now = new Date();
      mockSyncRepo.getLogs.mockResolvedValue([
        {
          id: 1,
          serverId: 'g1',
          syncType: 'manual',
          status: 'success',
          membersSynced: 5,
          rolesSynced: 2,
          message: null,
          startedAt: now,
          finishedAt: now,
        },
      ]);
      mockSyncRepo.countLogs.mockResolvedValue(1);

      const result = await service.getSyncLogs('g1', 20, 0);
      expect(result.total).toBe(1);
      expect(result.logs[0].syncType).toBe('manual');
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

  // ── getAllServersSyncStatus ───────────────────────────────────────────

  describe('getAllServersSyncStatus', () => {
    it('returns one status entry per active server', async () => {
      const now = new Date();
      mockServersRepo.findAllActive.mockResolvedValue([
        { id: 'g1' },
        { id: 'g2' },
      ]);
      mockSyncRepo.getLatestLog
        .mockResolvedValueOnce({
          serverId: 'g1',
          status: 'success',
          membersSynced: 10,
          rolesSynced: 2,
          message: null,
          startedAt: now,
          finishedAt: now,
        })
        .mockResolvedValueOnce(null);

      const result = await service.getAllServersSyncStatus();
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('success');
      expect(result[1].status).toBe('never');
    });
  });

  // ── recordEventChange ────────────────────────────────────────────────

  describe('recordEventChange', () => {
    it('creates an incremental log and a change detail', async () => {
      mockSyncRepo.createLog.mockResolvedValue({ id: 99 });
      mockSyncRepo.updateLog.mockResolvedValue({});
      mockSyncRepo.createChangeDetail.mockResolvedValue({});

      await service.recordEventChange(
        'g1',
        'member',
        'u1',
        'added',
        'Member joined',
      );
      expect(mockSyncRepo.createLog).toHaveBeenCalledWith(
        'g1',
        'incremental',
        'success',
        expect.any(Date),
      );
      expect(mockSyncRepo.createChangeDetail).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'member', action: 'added' }),
      );
    });

    it('swallows errors so gateway events are not disrupted', async () => {
      mockSyncRepo.createLog.mockRejectedValue(new Error('db error'));
      await expect(
        service.recordEventChange('g1', 'member', 'u1', 'added'),
      ).resolves.not.toThrow();
    });
  });

  // ── flushChangeBuffer ─────────────────────────────────────────────────

  describe('flushChangeBuffer', () => {
    it('inserts records in chunks of 500', async () => {
      mockSyncRepo.createChangeDetails.mockResolvedValue([]);
      const buffer = Array.from({ length: 1200 }, (_, i) => ({
        syncLogId: 1,
        serverId: 'g1',
        entityType: 'member',
        entityId: `u${i}`,
        action: 'updated',
      }));

      await service.flushChangeBuffer(buffer);
      // 1200 records → 3 calls (500 + 500 + 200)
      expect(mockSyncRepo.createChangeDetails).toHaveBeenCalledTimes(3);
    });

    it('does nothing for an empty buffer', async () => {
      await service.flushChangeBuffer([]);
      expect(mockSyncRepo.createChangeDetails).not.toHaveBeenCalled();
    });
  });
});
