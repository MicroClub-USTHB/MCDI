import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProjectAuthCacheService } from './project-auth-cache.service';
import { RedisService } from '../../common/redis/redis.service';

const fakeProject = () => ({
  id: 'proj-1',
  name: 'Project One',
  description: 'desc',
  apiKeyHash: 'hash',
  apiKeyPrefix: 'pk_test',
  apiKeyLastUsedAt: new Date('2026-03-24T10:00:00.000Z'),
  apiKeyCreatedAt: new Date('2026-03-23T10:00:00.000Z'),
  isInternal: false,
  webhookUrl: 'https://example.com/webhook',
  redirectUri: 'https://example.com/callback',
  isActive: true,
  createdAt: new Date('2026-03-20T10:00:00.000Z'),
  updatedAt: new Date('2026-03-24T10:00:00.000Z'),
});

const mockRedisService = {
  getJson: jest.fn(),
  setJson: jest.fn(),
  setNx: jest.fn(),
  delete: jest.fn(),
  sAdd: jest.fn(),
  sMembers: jest.fn(),
  expire: jest.fn(),
  scanKeys: jest.fn(),
};

async function buildService(config: Record<string, unknown> = {}) {
  const module = await Test.createTestingModule({
    providers: [
      ProjectAuthCacheService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => config[key]),
        },
      },
      { provide: RedisService, useValue: mockRedisService },
    ],
  }).compile();

  return module.get(ProjectAuthCacheService);
}

describe('ProjectAuthCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisService.delete.mockResolvedValue(0);
    mockRedisService.sMembers.mockResolvedValue([]);
    mockRedisService.scanKeys.mockResolvedValue([]);
    mockRedisService.setNx.mockResolvedValue(false);
  });

  it('stores a serialized project entry and project index in Redis', async () => {
    const service = await buildService({
      'app.projectAuthCacheTtlMs': 30_000,
      'redis.keyPrefix': 'mcdi',
    });

    await service.set('pk_test.secret', fakeProject());

    expect(mockRedisService.setJson).toHaveBeenCalledWith(
      expect.stringMatching(/^mcdi:project-auth:entry:/),
      expect.objectContaining({
        id: 'proj-1',
        apiKeyCreatedAt: '2026-03-23T10:00:00.000Z',
      }),
      30_000,
    );
    expect(mockRedisService.sAdd).toHaveBeenCalledWith(
      'mcdi:project-auth:project:proj-1',
      expect.stringMatching(/^mcdi:project-auth:entry:/),
    );
    expect(mockRedisService.expire).toHaveBeenCalledWith(
      'mcdi:project-auth:project:proj-1',
      90,
    );
  });

  it('hydrates project dates when reading from Redis', async () => {
    mockRedisService.getJson.mockResolvedValue({
      id: 'proj-1',
      name: 'Project One',
      description: 'desc',
      apiKeyHash: 'hash',
      apiKeyPrefix: 'pk_test',
      apiKeyLastUsedAt: '2026-03-24T10:00:00.000Z',
      apiKeyCreatedAt: '2026-03-23T10:00:00.000Z',
      isInternal: false,
      webhookUrl: 'https://example.com/webhook',
      redirectUri: 'https://example.com/callback',
      isActive: true,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-24T10:00:00.000Z',
    });

    const service = await buildService();
    const project = await service.get('pk_test.secret');

    expect(project).toMatchObject({
      id: 'proj-1',
      apiKeyPrefix: 'pk_test',
    });
    expect(project?.apiKeyCreatedAt).toBeInstanceOf(Date);
    expect(project?.apiKeyLastUsedAt).toBeInstanceOf(Date);
  });

  it('invalidates all entries indexed for a project', async () => {
    mockRedisService.sMembers.mockResolvedValue([
      'mcdi:project-auth:entry:a',
      'mcdi:project-auth:entry:b',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await service.invalidateProject('proj-1');

    expect(mockRedisService.delete).toHaveBeenCalledWith(
      'mcdi:project-auth:project:proj-1',
      'mcdi:project-auth:entry:a',
      'mcdi:project-auth:entry:b',
    );
  });

  it('clears all project-auth keys discovered by scan', async () => {
    mockRedisService.scanKeys.mockResolvedValue([
      'mcdi:project-auth:entry:a',
      'mcdi:project-auth:project:proj-1',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await service.clear();

    expect(mockRedisService.delete).toHaveBeenCalledWith(
      'mcdi:project-auth:entry:a',
      'mcdi:project-auth:project:proj-1',
    );
  });

  it('returns the number of cached auth entries from size()', async () => {
    mockRedisService.scanKeys.mockResolvedValue([
      'mcdi:project-auth:entry:a',
      'mcdi:project-auth:entry:b',
    ]);

    const service = await buildService({ 'redis.keyPrefix': 'mcdi' });
    await expect(service.size()).resolves.toBe(2);
  });

  it('uses Redis NX gating for last-used timestamp refreshes', async () => {
    mockRedisService.setNx.mockResolvedValue(true);

    const service = await buildService({
      'app.projectLastUsedWriteTtlMs': 60_000,
      'redis.keyPrefix': 'mcdi',
    });

    await expect(service.shouldRefreshLastUsed('proj-1')).resolves.toBe(true);
    expect(mockRedisService.setNx).toHaveBeenCalledWith(
      'mcdi:project-auth:last-used:proj-1',
      '1',
      60_000,
    );
  });
});
