import { Test, TestingModule } from '@nestjs/testing';
import { SyncListener } from './sync.listener';
import { DiscordService } from '../discord/discord.service';
import { SyncService } from './sync.service';

const SYNC_EVENTS = [
  'guildMemberAdd',
  'guildMemberRemove',
  'guildMemberUpdate',
  'userUpdate',
  'roleCreate',
  'roleUpdate',
  'roleDelete',
  'guildCreate',
  'guildUpdate',
  'guildDelete',
] as const;

function buildMockClient() {
  return {
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn().mockReturnValue(undefined),
    isReady: jest.fn().mockReturnValue(false),
    removeAllListeners: jest.fn(),
  };
}

function buildMockSyncService() {
  return {
    startupSyncAll: jest.fn().mockResolvedValue(undefined),
    handleMemberAdd: jest.fn().mockResolvedValue(undefined),
    handleMemberRemove: jest.fn().mockResolvedValue(undefined),
    handleMemberUpdate: jest.fn().mockResolvedValue(undefined),
    handleUserUpdate: jest.fn().mockResolvedValue(undefined),
    handleRoleCreate: jest.fn().mockResolvedValue(undefined),
    handleRoleUpdate: jest.fn().mockResolvedValue(undefined),
    handleRoleDelete: jest.fn().mockResolvedValue(undefined),
    handleGuildCreate: jest.fn().mockResolvedValue(undefined),
    handleGuildUpdate: jest.fn().mockResolvedValue(undefined),
    handleGuildDelete: jest.fn().mockResolvedValue(undefined),
  };
}

async function buildModule(
  clientOverrides: Partial<ReturnType<typeof buildMockClient>> = {},
) {
  const mockClient = { ...buildMockClient(), ...clientOverrides };
  const mockSyncService = buildMockSyncService();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SyncListener,
      { provide: DiscordService, useValue: { getClient: () => mockClient } },
      { provide: SyncService, useValue: mockSyncService },
    ],
  }).compile();

  return { listener: module.get(SyncListener), mockClient, mockSyncService };
}

describe('SyncListener', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers all 10 Discord event listeners', async () => {
      const { listener, mockClient } = await buildModule();
      listener.onModuleInit();

      const registeredEvents = mockClient.on.mock.calls.map(
        ([evt]: [string]) => evt,
      );
      for (const event of SYNC_EVENTS) {
        expect(registeredEvents).toContain(event);
      }
      expect(mockClient.on).toHaveBeenCalledTimes(SYNC_EVENTS.length);
    });
  });

  describe('onModuleDestroy', () => {
    it('calls removeAllListeners for each of the 10 events', async () => {
      const { listener, mockClient } = await buildModule();
      listener.onModuleInit();
      listener.onModuleDestroy();

      for (const event of SYNC_EVENTS) {
        expect(mockClient.removeAllListeners).toHaveBeenCalledWith(event);
      }
      expect(mockClient.removeAllListeners).toHaveBeenCalledTimes(
        SYNC_EVENTS.length,
      );
    });
  });

  describe('onApplicationBootstrap', () => {
    it('calls startupSyncAll immediately when client is already ready', async () => {
      const { listener, mockSyncService } = await buildModule({
        isReady: jest.fn().mockReturnValue(true),
      });
      listener.onApplicationBootstrap();

      // scheduleStartupSync is called synchronously; startupSyncAll is called async
      await Promise.resolve();
      expect(mockSyncService.startupSyncAll).toHaveBeenCalledTimes(1);
    });

    it('waits for the ready event when client is not ready', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule({
        isReady: jest.fn().mockReturnValue(false),
      });
      listener.onApplicationBootstrap();

      expect(mockSyncService.startupSyncAll).not.toHaveBeenCalled();
      expect(mockClient.once).toHaveBeenCalledWith(
        'ready',
        expect.any(Function),
      );
    });
  });

  describe('event handler — guildMemberAdd', () => {
    it('delegates to syncService.handleMemberAdd', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildMemberAdd',
      )!;
      const fakeMember = { id: 'mem-1', guild: { id: 'srv-1' } };
      await handler(fakeMember);

      expect(mockSyncService.handleMemberAdd).toHaveBeenCalledWith(fakeMember);
    });

    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleMemberAdd.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildMemberAdd',
      )!;
      await expect(handler({ id: 'mem-1' })).resolves.toBeUndefined();
    });
  });

  describe('event handler — guildMemberRemove', () => {
    it('delegates to syncService.handleMemberRemove', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildMemberRemove',
      )!;
      const fakeMember = { id: 'mem-1' };
      await handler(fakeMember);

      expect(mockSyncService.handleMemberRemove).toHaveBeenCalledWith(
        fakeMember,
      );
    });
  });

  describe('event handler — guildMemberUpdate', () => {
    it('delegates to syncService.handleMemberUpdate', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildMemberUpdate',
      )!;
      const [oldM, newM] = [
        { id: 'mem-1' },
        { id: 'mem-1', displayName: 'new' },
      ];
      await handler(oldM, newM);

      expect(mockSyncService.handleMemberUpdate).toHaveBeenCalledWith(
        oldM,
        newM,
      );
    });
  });

  describe('event handler — userUpdate', () => {
    it('delegates to syncService.handleUserUpdate', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'userUpdate',
      )!;
      const [oldU, newU] = [{ id: 'u-1' }, { id: 'u-1', username: 'new' }];
      await handler(oldU, newU);

      expect(mockSyncService.handleUserUpdate).toHaveBeenCalledWith(oldU, newU);
    });
  });

  describe('event handler — roleCreate', () => {
    it('delegates to syncService.handleRoleCreate', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'roleCreate',
      )!;
      const fakeRole = { id: 'role-1', name: 'Mod' };
      await handler(fakeRole);

      expect(mockSyncService.handleRoleCreate).toHaveBeenCalledWith(fakeRole);
    });
  });

  describe('event handler — roleUpdate', () => {
    it('delegates to syncService.handleRoleUpdate with newRole', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'roleUpdate',
      )!;
      const [oldR, newR] = [
        { id: 'role-1', name: 'Old' },
        { id: 'role-1', name: 'New' },
      ];
      await handler(oldR, newR);

      expect(mockSyncService.handleRoleUpdate).toHaveBeenCalledWith(newR);
    });
  });

  describe('event handler — roleDelete', () => {
    it('delegates to syncService.handleRoleDelete', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'roleDelete',
      )!;
      const fakeRole = { id: 'role-1' };
      await handler(fakeRole);

      expect(mockSyncService.handleRoleDelete).toHaveBeenCalledWith(fakeRole);
    });
  });

  describe('event handler — guildCreate', () => {
    it('delegates to syncService.handleGuildCreate', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildCreate',
      )!;
      const fakeGuild = { id: 'guild-1', name: 'Main' };
      await handler(fakeGuild);

      expect(mockSyncService.handleGuildCreate).toHaveBeenCalledWith(fakeGuild);
    });
  });

  describe('event handler — guildUpdate', () => {
    it('delegates to syncService.handleGuildUpdate', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildUpdate',
      )!;
      const [oldG, newG] = [
        { id: 'g-1', name: 'Old' },
        { id: 'g-1', name: 'New' },
      ];
      await handler(oldG, newG);

      expect(mockSyncService.handleGuildUpdate).toHaveBeenCalledWith(
        oldG,
        newG,
      );
    });
  });

  describe('event handler — guildDelete', () => {
    it('delegates to syncService.handleGuildDelete', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      listener.onModuleInit();

      const [, handler] = mockClient.on.mock.calls.find(
        ([e]: [string]) => e === 'guildDelete',
      )!;
      const fakeGuild = { id: 'guild-1' };
      await handler(fakeGuild);

      expect(mockSyncService.handleGuildDelete).toHaveBeenCalledWith(fakeGuild);
    });
  });

  // ─── Error-path coverage for remaining handlers ──────────────────────────

  function findHandler(
    mockClient: ReturnType<typeof buildMockClient>,
    event: string,
  ) {
    return mockClient.on.mock.calls.find(([e]: [string]) => e === event)![1];
  }

  describe('error path — guildMemberRemove', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleMemberRemove.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'guildMemberRemove');
      await expect(handler({ id: 'mem-1' })).resolves.toBeUndefined();
    });
  });

  describe('error path — guildMemberUpdate', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleMemberUpdate.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'guildMemberUpdate');
      await expect(handler({ id: 'a' }, { id: 'b' })).resolves.toBeUndefined();
    });
  });

  describe('error path — userUpdate', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleUserUpdate.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'userUpdate');
      await expect(handler({ id: 'a' }, { id: 'b' })).resolves.toBeUndefined();
    });
  });

  describe('error path — roleCreate', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleRoleCreate.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'roleCreate');
      await expect(handler({ id: 'r-1' })).resolves.toBeUndefined();
    });
  });

  describe('error path — roleUpdate', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleRoleUpdate.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'roleUpdate');
      await expect(
        handler({ id: 'r-1' }, { id: 'r-1', name: 'New' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('error path — roleDelete', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleRoleDelete.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'roleDelete');
      await expect(handler({ id: 'r-1' })).resolves.toBeUndefined();
    });
  });

  describe('error path — guildCreate', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleGuildCreate.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'guildCreate');
      await expect(handler({ id: 'g-1' })).resolves.toBeUndefined();
    });
  });

  describe('error path — guildUpdate', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleGuildUpdate.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'guildUpdate');
      await expect(
        handler({ id: 'g-1' }, { id: 'g-1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('error path — guildDelete', () => {
    it('does not throw when service rejects', async () => {
      const { listener, mockClient, mockSyncService } = await buildModule();
      mockSyncService.handleGuildDelete.mockRejectedValue(new Error('oops'));
      listener.onModuleInit();
      const handler = await findHandler(mockClient, 'guildDelete');
      await expect(handler({ id: 'g-1' })).resolves.toBeUndefined();
    });
  });

  describe('error path — scheduleStartupSync (non-Error rejection)', () => {
    it('does not throw when startupSyncAll rejects with a non-Error', async () => {
      const { listener, mockSyncService } = await buildModule({
        isReady: jest.fn().mockReturnValue(true),
      });
      mockSyncService.startupSyncAll.mockRejectedValue('string-error');

      listener.onApplicationBootstrap();
      await new Promise((resolve) => setTimeout(resolve, 0));
      // No uncaught rejection means branch was handled
    });
  });
});
