import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProjectAccessCacheService } from './project-access-cache.service';
import { RedisService } from '../../common/redis/redis.service';

const mockRedisService = {
  getJson: jest.fn(),
  setJson: jest.fn(),
  delete: jest.fn(),
  sAdd: jest.fn(),
  sMembers: jest.fn(),
  expire: jest.fn(),
  scanKeys: jest.fn(),
};

const fakeContext = () => ({
  projectId: 'proj-1',
  serverId: 'guild-1',
  operations: {
    READ: true,
    SEND_MESSAGES: true,
    MANAGE_WEBHOOKS: false,
  },
  scopes: ['read_members', 'write_messages'],
});

async function buildService(config: Record<string, unknown> = {}) {
  const module = await Test.createTestingModule({
    providers: [
      ProjectAccessCacheService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => config[key]),
        },
      },
      { provide: RedisService, useValue: mockRedisService },
    ],
  }).compile();

  return module.get(ProjectAccessCacheService);
}

describe('ProjectAccessCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisService.delete.mockResolvedValue(0);
    mockRedisService.sMembers.mockResolvedValue([]);
    mockRedisService.scanKeys.mockResolvedValue([]);
  });

  it('stores a project-server access entry and both index keys', async () => {
    const service = await buildService({
      'app.projectAccessCacheTtlMs': 30_000,
      'redis.keyPrefix': 'mcdi',
    });

    await service.set(fakeContext());

    expect(mockRedisService.setJson).toHaveBeenCalledWith(
      'mcdi:project-access:entry:proj-1:guild-1',
      fakeContext(),
      30_000,
    );
    expect(mockRedisService.sAdd).toHaveBeenCalledWith(
      'mcdi:project-access:project:proj-1',
      'mcdi:project-access:entry:proj-1:guild-1',
    );
    expect(mockRedisService.sAdd).toHaveBeenCalledWith(
      'mcdi:project-access:server:guild-1',
      'mcdi:project-access:entry:proj-1:guild-1',
    );
  });

  it('returns the cached access context from Redis', async () => {
    mockRedisService.getJson.mockResolvedValue(fakeContext());

    const service = await buildService();
    await expect(service.get('proj-1', 'guild-1')).resolves.toEqual(
      fakeContext(),
    );
  });

  it('invalidates all entries for a project', async () => {
    mockRedisService.sMembers.mockResolvedValue([
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:entry:proj-1:guild-2',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await service.invalidateProject('proj-1');

    expect(mockRedisService.delete).toHaveBeenCalledWith(
      'mcdi:project-access:project:proj-1',
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:entry:proj-1:guild-2',
    );
  });

  it('invalidates all entries for a server', async () => {
    mockRedisService.sMembers.mockResolvedValue([
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:entry:proj-2:guild-1',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await service.invalidateServer('guild-1');

    expect(mockRedisService.delete).toHaveBeenCalledWith(
      'mcdi:project-access:server:guild-1',
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:entry:proj-2:guild-1',
    );
  });

  it('clears all access-cache keys discovered by scan', async () => {
    mockRedisService.scanKeys.mockResolvedValue([
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:project:proj-1',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await service.clear();

    expect(mockRedisService.delete).toHaveBeenCalledWith(
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:project:proj-1',
    );
  });

  it('returns the number of access entries from size()', async () => {
    mockRedisService.scanKeys.mockResolvedValue([
      'mcdi:project-access:entry:proj-1:guild-1',
      'mcdi:project-access:entry:proj-2:guild-2',
      'mcdi:project-access:entry:proj-3:guild-3',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await expect(service.size()).resolves.toBe(3);
  });
});
