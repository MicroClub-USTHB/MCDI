import { Test, TestingModule } from '@nestjs/testing';
import { ServerSyncService } from './server-sync.service';
import { ServersRepository } from '../../servers/servers.repository';
import { SyncRepository } from '../sync.repository';
import { SyncTarget } from '../dto/trigger-sync.dto';

const mockServersRepo = {
  updateById: jest.fn(),
  upsertServer: jest.fn(),
};

const mockSyncRepo = {
  createLog: jest.fn(),
  getInProgressLog: jest.fn(),
  getActiveLog: jest.fn(),
};

const makeGuild = (overrides: Partial<any> = {}): any => ({
  id: 'guild-1',
  name: 'Test Server',
  iconURL: () => 'https://cdn.discord/icon.png',
  ...overrides,
});

describe('ServerSyncService', () => {
  let service: ServerSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServerSyncService,
        { provide: ServersRepository, useValue: mockServersRepo },
        { provide: SyncRepository, useValue: mockSyncRepo },
      ],
    }).compile();
    service = module.get(ServerSyncService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── syncServerInfo ────────────────────────────────────────────────────

  describe('syncServerInfo', () => {
    it('updates server metadata and pushes a change entry', async () => {
      mockServersRepo.updateById.mockResolvedValue(undefined);
      const buffer: any[] = [];
      await service.syncServerInfo(
        'guild-1',
        makeGuild(),
        new Date(),
        1,
        buffer,
      );

      expect(mockServersRepo.updateById).toHaveBeenCalledWith(
        'guild-1',
        expect.objectContaining({ name: 'Test Server' }),
      );
      expect(buffer).toHaveLength(1);
      expect(buffer[0].entityType).toBe('server');
    });
  });

  // ── prepareGuildCreate ────────────────────────────────────────────────

  describe('prepareGuildCreate', () => {
    it('upserts the server and returns shouldSync=true + log id when no sync in progress', async () => {
      mockServersRepo.upsertServer.mockResolvedValue(undefined);
      mockSyncRepo.getActiveLog.mockResolvedValue(null);
      mockSyncRepo.createLog.mockResolvedValue({ id: 55 });

      const result = await service.prepareGuildCreate(makeGuild());
      expect(result).toEqual({ shouldSync: true, logId: 55 });
      expect(mockServersRepo.upsertServer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'guild-1', isActive: true }),
      );
      expect(mockSyncRepo.createLog).toHaveBeenCalledWith(
        'guild-1',
        'full',
        'queued',
        expect.any(Date),
        SyncTarget.ALL,
      );
    });

    it('returns shouldSync=false when a sync is already in progress', async () => {
      mockServersRepo.upsertServer.mockResolvedValue(undefined);
      mockSyncRepo.getActiveLog.mockResolvedValue({
        id: 10,
        status: 'in_progress',
      });

      const result = await service.prepareGuildCreate(makeGuild());
      expect(result).toEqual({ shouldSync: false });
      expect(mockSyncRepo.createLog).not.toHaveBeenCalled();
    });
  });

  // ── handleGuildDelete ─────────────────────────────────────────────────

  describe('handleGuildDelete', () => {
    it('marks the server as inactive', async () => {
      mockServersRepo.updateById.mockResolvedValue(undefined);
      await service.handleGuildDelete(makeGuild());
      expect(mockServersRepo.updateById).toHaveBeenCalledWith(
        'guild-1',
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ── handleGuildUpdate ─────────────────────────────────────────────────

  describe('handleGuildUpdate', () => {
    it('updates server name and icon', async () => {
      mockServersRepo.updateById.mockResolvedValue(undefined);
      const updated = makeGuild({ name: 'Renamed Server' });
      await service.handleGuildUpdate(makeGuild(), updated);
      expect(mockServersRepo.updateById).toHaveBeenCalledWith(
        'guild-1',
        expect.objectContaining({ name: 'Renamed Server' }),
      );
    });
  });
});
