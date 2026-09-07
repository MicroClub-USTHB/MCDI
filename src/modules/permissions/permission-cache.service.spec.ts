import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PermissionCacheService } from './permission-cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { SettingsService } from '../admin-settings/settings.service';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
let lastSettingsMock: {
  getPermissionCacheTtlMs: jest.Mock;
  registerChangeListener: jest.Mock;
};

const fakeEntry = () => ({
  permissions: ['READ_MEMBERS', 'WRITE_ROLES'],
  sources: {
    global: [] as string[],
    server: ['READ_MEMBERS'],
    hierarchy: [] as string[],
    inherited: ['WRITE_ROLES'],
  },
});

const mockRedisService = {
  getJson: jest.fn(),
  setJson: jest.fn(),
  delete: jest.fn(),
  sAdd: jest.fn(),
  sMembers: jest.fn(),
  expire: jest.fn(),
  scanKeys: jest.fn(),
};

async function buildService(config: Record<string, unknown> = {}) {
  lastSettingsMock = {
    getPermissionCacheTtlMs: jest
      .fn()
      .mockReturnValue(
        (config['app.permissionCacheTtlMs'] as number) ?? DEFAULT_TTL_MS,
      ),
    registerChangeListener: jest.fn(),
  };
  const module = await Test.createTestingModule({
    providers: [
      PermissionCacheService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => config[key]),
        },
      },
      { provide: RedisService, useValue: mockRedisService },
      { provide: SettingsService, useValue: lastSettingsMock },
    ],
  }).compile();

  const svc = module.get(PermissionCacheService);
  svc.onModuleInit();
  return svc;
}

describe('PermissionCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisService.delete.mockResolvedValue(0);
    mockRedisService.sMembers.mockResolvedValue([]);
    mockRedisService.scanKeys.mockResolvedValue([]);
  });

  describe('get — cache miss', () => {
    it('returns null when no entry exists for (memberId, serverId)', async () => {
      mockRedisService.getJson.mockResolvedValue(null);

      const svc = await buildService();
      const result = await svc.get('mem-1', 'srv-1');

      expect(result).toBeNull();
      expect(mockRedisService.getJson).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:entry:mem-1:srv-1'),
      );
    });
  });

  describe('set & get', () => {
    it('caches and retrieves permissions for a member/server pair', async () => {
      const entry = fakeEntry();
      mockRedisService.getJson.mockResolvedValue(entry);

      const svc = await buildService();
      await svc.set('mem-1', 'srv-1', entry);

      const result = await svc.get('mem-1', 'srv-1');
      expect(result).not.toBeNull();
      expect(result!.permissions).toEqual(['READ_MEMBERS', 'WRITE_ROLES']);
      expect(result!.sources.server).toEqual(['READ_MEMBERS']);
    });

    it('stores different entries per member/server combination', async () => {
      const svc = await buildService();

      mockRedisService.getJson.mockImplementation((key: string) => {
        if (key.includes('mem-1:srv-1'))
          return {
            permissions: ['A'],
            sources: { global: [], server: [], hierarchy: [], inherited: [] },
          };
        if (key.includes('mem-2:srv-1'))
          return {
            permissions: ['B'],
            sources: { global: [], server: [], hierarchy: [], inherited: [] },
          };
        return null;
      });

      await svc.set('mem-1', 'srv-1', fakeEntry());
      await svc.set('mem-2', 'srv-1', fakeEntry());

      expect((await svc.get('mem-1', 'srv-1'))!.permissions).toEqual(['A']);
      expect((await svc.get('mem-2', 'srv-1'))!.permissions).toEqual(['B']);
    });

    it('size() reflects number of cached entries', async () => {
      mockRedisService.scanKeys.mockResolvedValue(['k1', 'k2']);

      const svc = await buildService();
      expect(await svc.size()).toBe(2);
    });
  });

  describe('set — stores entry and maintains indices', () => {
    it('sets JSON entry with TTL and adds to member/server indices', async () => {
      const svc = await buildService({ 'app.permissionCacheTtlMs': 10_000 });

      await svc.set('mem-1', 'srv-1', fakeEntry());

      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:entry:mem-1:srv-1'),
        fakeEntry(),
        10_000,
      );
      expect(mockRedisService.sAdd).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:member:mem-1'),
        expect.stringContaining('perm-cache:entry:mem-1:srv-1'),
      );
      expect(mockRedisService.sAdd).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:server:srv-1'),
        expect.stringContaining('perm-cache:entry:mem-1:srv-1'),
      );
    });
  });

  describe('invalidateMember', () => {
    it('removes all entries for a given memberId across all servers', async () => {
      mockRedisService.sMembers.mockResolvedValue([
        'mcdi:perm-cache:entry:mem-1:srv-1',
        'mcdi:perm-cache:entry:mem-1:srv-2',
      ]);

      const svc = await buildService();
      await svc.invalidateMember('mem-1');

      expect(mockRedisService.sMembers).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:member:mem-1'),
      );
      expect(mockRedisService.delete).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:member:mem-1'),
        'mcdi:perm-cache:entry:mem-1:srv-1',
        'mcdi:perm-cache:entry:mem-1:srv-2',
      );
    });

    it('does nothing when no entries exist for the member', async () => {
      mockRedisService.sMembers.mockResolvedValue([]);

      const svc = await buildService();
      await expect(svc.invalidateMember('mem-1')).resolves.not.toThrow();

      expect(mockRedisService.delete).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:member:mem-1'),
      );
    });
  });

  describe('invalidateServer', () => {
    it('removes all entries for a given serverId across all members', async () => {
      mockRedisService.sMembers.mockResolvedValue([
        'mcdi:perm-cache:entry:mem-1:srv-1',
        'mcdi:perm-cache:entry:mem-2:srv-1',
      ]);

      const svc = await buildService();
      await svc.invalidateServer('srv-1');

      expect(mockRedisService.sMembers).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:server:srv-1'),
      );
      expect(mockRedisService.delete).toHaveBeenCalledWith(
        expect.stringContaining('perm-cache:idx:server:srv-1'),
        'mcdi:perm-cache:entry:mem-1:srv-1',
        'mcdi:perm-cache:entry:mem-2:srv-1',
      );
    });

    it('does nothing when no entries exist for the server', async () => {
      mockRedisService.sMembers.mockResolvedValue([]);

      const svc = await buildService();
      await expect(svc.invalidateServer('srv-x')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('flushes all entries from the cache', async () => {
      mockRedisService.scanKeys.mockResolvedValue([
        'mcdi:perm-cache:entry:mem-1:srv-1',
        'mcdi:perm-cache:entry:mem-2:srv-2',
      ]);

      const svc = await buildService();
      await svc.clear();

      expect(mockRedisService.scanKeys).toHaveBeenCalledWith(
        'mcdi:perm-cache:*',
      );
      expect(mockRedisService.delete).toHaveBeenCalledWith(
        'mcdi:perm-cache:entry:mem-1:srv-1',
        'mcdi:perm-cache:entry:mem-2:srv-2',
      );
    });

    it('does not throw when store is already empty', async () => {
      mockRedisService.scanKeys.mockResolvedValue([]);

      const svc = await buildService();
      await expect(svc.clear()).resolves.not.toThrow();
    });
  });

  describe('settings change listener', () => {
    it('registers a listener on init that flushes on permissionCacheTtlMs change', async () => {
      mockRedisService.scanKeys.mockResolvedValue([
        'mcdi:perm-cache:entry:mem-1:srv-1',
      ]);
      await buildService();

      expect(lastSettingsMock.registerChangeListener).toHaveBeenCalledTimes(1);
      const listener = lastSettingsMock.registerChangeListener.mock
        .calls[0][0] as (keys: string[]) => Promise<void>;

      await listener(['permissionCacheTtlMs']);
      expect(mockRedisService.scanKeys).toHaveBeenCalledWith(
        'mcdi:perm-cache:*',
      );

      mockRedisService.scanKeys.mockClear();
      await listener(['statsCacheTtlMs']);
      expect(mockRedisService.scanKeys).not.toHaveBeenCalled();
    });
  });
});
