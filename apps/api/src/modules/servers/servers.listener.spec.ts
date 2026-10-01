import { Test, TestingModule } from '@nestjs/testing';
import { ServersListener } from './servers.listener';
import { DiscordService } from '../discord/discord.service';
import { ServersService } from './servers.service';
import { Guild } from 'discord.js';

function buildMockClient() {
  return {
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    isReady: jest.fn().mockReturnValue(false),
    removeAllListeners: jest.fn(),
  };
}

describe('ServersListener', () => {
  let listener: ServersListener;
  let mockClient: ReturnType<typeof buildMockClient>;
  let mockServersService: { registerServer: jest.Mock };

  beforeEach(async () => {
    mockClient = buildMockClient();
    mockServersService = {
      registerServer: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServersListener,
        { provide: DiscordService, useValue: { getClient: () => mockClient } },
        { provide: ServersService, useValue: mockServersService },
      ],
    }).compile();

    listener = module.get(ServersListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers a guildCreate listener on the Discord client', () => {
      listener.onModuleInit();
      expect(mockClient.on).toHaveBeenCalledWith(
        'guildCreate',
        expect.any(Function),
      );
    });
  });

  describe('guildCreate handler', () => {
    it('calls serversService.registerServer with guild data', async () => {
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([evt]: [string]) => evt === 'guildCreate',
      )!;
      const fakeGuild = {
        id: 'guild-1',
        name: 'Test Guild',
        iconURL: jest.fn().mockReturnValue('http://icon.png'),
      } as unknown as Guild;

      await handler(fakeGuild);

      expect(mockServersService.registerServer).toHaveBeenCalledWith({
        guildId: 'guild-1',
        name: 'Test Guild',
        icon: 'http://icon.png',
        isActive: true,
      });
    });

    it('does not throw if registerServer rejects (error is caught internally)', async () => {
      mockServersService.registerServer.mockRejectedValue(
        new Error('DB error'),
      );
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([evt]: [string]) => evt === 'guildCreate',
      )!;
      const fakeGuild = {
        id: 'guild-1',
        name: 'Test Guild',
        iconURL: jest.fn().mockReturnValue(null),
      } as unknown as Guild;

      await expect(handler(fakeGuild)).resolves.toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('removes the guildCreate listener from the client', () => {
      listener.onModuleInit();
      listener.onModuleDestroy();
      expect(mockClient.off).toHaveBeenCalledWith(
        'guildCreate',
        expect.any(Function),
      );
    });

    it('does nothing if onModuleInit was never called (no boundHandler)', () => {
      // boundHandler is undefined — should not throw
      expect(() => listener.onModuleDestroy()).not.toThrow();
      expect(mockClient.off).not.toHaveBeenCalled();
    });
  });
});
