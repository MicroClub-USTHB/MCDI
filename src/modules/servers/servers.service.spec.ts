import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ServersRepository } from './servers.repository';
import { DiscordService } from '../discord/discord.service';
import { ProjectAccessCacheService } from '../projects/project-access-cache.service';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockServersRepo = {
  clearMainServer: jest.fn(),
  upsertServer: jest.fn(),
  listServersWithLastSync: jest.fn(),
  findById: jest.fn(),
  updateById: jest.fn(),
  deleteServerCascade: jest.fn(),
};

const mockDiscordService = {
  hasGuildConnection: jest.fn(),
  getGuildById: jest.fn(),
  getClient: jest.fn(),
};

const mockProjectAccessCache = {
  invalidateServer: jest.fn(),
};

const fakeServer = (overrides = {}) => ({
  id: 'guild-1',
  name: 'Test Guild',
  icon: null,
  type: 'main',
  isMain: false,
  isActive: true,
  syncFrequencyHours: 1,
  defaultPermissionPolicy: 'deny_all',
  disabledReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: null,
  ...overrides,
});

// ── Suite ──────────────────────────────────────────────────────────────────

describe('ServersService', () => {
  let service: ServersService;

  beforeEach(async () => {
    mockDiscordService.hasGuildConnection.mockReturnValue(false);
    mockDiscordService.getClient.mockReturnValue({
      isReady: () => false,
      guilds: { cache: { has: () => false } },
    });
    mockProjectAccessCache.invalidateServer.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServersService,
        { provide: ServersRepository, useValue: mockServersRepo },
        { provide: DiscordService, useValue: mockDiscordService },
        {
          provide: ProjectAccessCacheService,
          useValue: mockProjectAccessCache,
        },
      ],
    }).compile();
    service = module.get(ServersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── registerServer ─────────────────────────────────────────────────────

  describe('registerServer', () => {
    it('upserts server data and returns the row', async () => {
      const server = fakeServer();
      mockDiscordService.getGuildById.mockResolvedValue({
        name: 'Guild',
        iconURL: () => null,
      });
      mockServersRepo.upsertServer.mockResolvedValue(server);

      const result = await service.registerServer({
        guildId: 'guild-1',
        name: 'Test Guild',
        type: 'main',
      });
      expect(result).toEqual(server);
      expect(mockServersRepo.upsertServer).toHaveBeenCalled();
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
    });

    it('calls clearMainServer when isMain is true', async () => {
      const server = fakeServer({ isMain: true });
      mockDiscordService.getGuildById.mockResolvedValue(null);
      mockServersRepo.clearMainServer.mockResolvedValue(undefined);
      mockServersRepo.upsertServer.mockResolvedValue(server);

      await service.registerServer({
        guildId: 'guild-1',
        name: 'G',
        isMain: true,
      });
      expect(mockServersRepo.clearMainServer).toHaveBeenCalled();
    });

    it('uses guild name from Discord when name is not provided', async () => {
      mockDiscordService.getGuildById.mockResolvedValue({
        name: 'DiscordName',
        iconURL: () => 'http://icon',
      });
      mockServersRepo.upsertServer.mockResolvedValue(
        fakeServer({ name: 'DiscordName' }),
      );

      await service.registerServer({ guildId: 'guild-1' });
      const callArg = mockServersRepo.upsertServer.mock.calls[0][0];
      expect(callArg.name).toBe('DiscordName');
    });
  });

  // ── getServerById ──────────────────────────────────────────────────────

  describe('getServerById', () => {
    it('returns the server when found', async () => {
      const server = fakeServer();
      mockServersRepo.findById.mockResolvedValue(server);
      expect(await service.getServerById('guild-1')).toEqual(server);
    });

    it('throws NotFoundException when server does not exist', async () => {
      mockServersRepo.findById.mockResolvedValue(null);
      await expect(service.getServerById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateServer ───────────────────────────────────────────────────────

  describe('updateServer', () => {
    it('returns the updated server', async () => {
      const server = fakeServer({ name: 'Updated' });
      mockServersRepo.findById.mockResolvedValue(fakeServer());
      mockServersRepo.updateById.mockResolvedValue(server);

      const result = await service.updateServer('guild-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
    });

    it('throws NotFoundException when server does not exist', async () => {
      mockServersRepo.findById.mockResolvedValue(null);
      await expect(service.updateServer('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when trying to unset the main server', async () => {
      mockServersRepo.findById.mockResolvedValue(fakeServer({ isMain: true }));

      await expect(
        service.updateServer('guild-1', { isMain: false }),
      ).rejects.toThrow(ConflictException);
      expect(mockServersRepo.updateById).not.toHaveBeenCalled();
    });
  });

  // ── deleteServer ───────────────────────────────────────────────────────

  describe('deleteServer', () => {
    it('deletes the server and returns confirmation message', async () => {
      mockServersRepo.findById.mockResolvedValue(fakeServer());
      mockServersRepo.deleteServerCascade.mockResolvedValue(undefined);

      const result = await service.deleteServer('guild-1');
      expect(result.message).toContain('deleted');
      expect(mockServersRepo.deleteServerCascade).toHaveBeenCalledWith(
        'guild-1',
      );
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
    });

    it('throws NotFoundException when server does not exist', async () => {
      mockServersRepo.findById.mockResolvedValue(null);
      await expect(service.deleteServer('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when trying to delete the main server', async () => {
      mockServersRepo.findById.mockResolvedValue(fakeServer({ isMain: true }));

      await expect(service.deleteServer('guild-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockServersRepo.deleteServerCascade).not.toHaveBeenCalled();
    });
  });

  // ── disableServer ──────────────────────────────────────────────────────

  describe('disableServer', () => {
    it('sets isActive=false and stores the reason', async () => {
      const server = fakeServer({
        isActive: false,
        disabledReason: 'Maintenance',
      });
      mockServersRepo.findById.mockResolvedValue(fakeServer());
      mockServersRepo.updateById.mockResolvedValue(server);

      const result = await service.disableServer('guild-1', {
        disabledReason: 'Maintenance',
      });
      expect(result.isActive).toBe(false);
      const callArgs = mockServersRepo.updateById.mock.calls[0][1];
      expect(callArgs.isActive).toBe(false);
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
    });

    it('throws NotFoundException when server does not exist', async () => {
      mockServersRepo.findById.mockResolvedValue(null);
      await expect(
        service.disableServer('missing', { disabledReason: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when trying to disable the main server', async () => {
      mockServersRepo.findById.mockResolvedValue(fakeServer({ isMain: true }));

      await expect(
        service.disableServer('guild-1', { disabledReason: 'x' }),
      ).rejects.toThrow(ConflictException);
      expect(mockServersRepo.updateById).not.toHaveBeenCalled();
    });
  });

  // ── enableServer ───────────────────────────────────────────────────────

  describe('enableServer', () => {
    it('sets isActive=true and clears disabledReason', async () => {
      const server = fakeServer({ isActive: true, disabledReason: null });
      mockServersRepo.updateById.mockResolvedValue(server);

      const result = await service.enableServer('guild-1');
      expect(result.isActive).toBe(true);
      const callArgs = mockServersRepo.updateById.mock.calls[0][1];
      expect(callArgs.isActive).toBe(true);
      expect(callArgs.disabledReason).toBeNull();
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
    });

    it('throws NotFoundException when server does not exist', async () => {
      mockServersRepo.updateById.mockResolvedValue(null);
      await expect(service.enableServer('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── listServers ────────────────────────────────────────────────────────

  describe('listServers', () => {
    it('returns servers with botConnected=false when the bot is not connected', async () => {
      mockServersRepo.listServersWithLastSync.mockResolvedValue([
        { id: 'guild-1', name: 'Guild' },
      ]);
      mockDiscordService.hasGuildConnection.mockReturnValue(false);

      const result = await service.listServers();
      expect(result[0].botConnected).toBe(false);
    });

    it('returns botConnected=true when DiscordService reports a guild connection', async () => {
      mockServersRepo.listServersWithLastSync.mockResolvedValue([
        { id: 'guild-1', name: 'Guild' },
      ]);
      mockDiscordService.hasGuildConnection.mockImplementation(
        (id: string) => id === 'guild-1',
      );

      const result = await service.listServers();
      expect(result[0].botConnected).toBe(true);
      expect(mockDiscordService.hasGuildConnection).toHaveBeenCalledWith(
        'guild-1',
      );
    });
  });

  // ── registerServer — error path ──────────────────────────────────────────

  describe('registerServer (error path)', () => {
    it('rethrows HttpException from inner code', async () => {
      mockDiscordService.getGuildById.mockRejectedValue(
        new NotFoundException('Guild not found'),
      );

      await expect(
        service.registerServer({ guildId: 'bad-id' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateServer — isMain=false branch ──────────────────────────────────

  describe('updateServer (additional branches)', () => {
    it('sets isMain=false in patch when dto.isMain is explicitly false', async () => {
      const server = fakeServer({ isMain: false });
      mockServersRepo.findById.mockResolvedValue(server);
      mockServersRepo.updateById.mockResolvedValue(server);

      await service.updateServer('guild-1', { isMain: false });

      const patch = mockServersRepo.updateById.mock.calls[0][1];
      expect(patch.isMain).toBe(false);
    });
  });
});
