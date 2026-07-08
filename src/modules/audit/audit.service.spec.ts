import { Test } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { RedisService } from '../../common/redis/redis.service';
import { DiscordService } from '../discord/discord.service';
import { DATABASE_POOL } from '../../database/database.module';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const fakeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  createdAt: new Date('2026-04-01T12:00:00.000Z'),
  actorId: 'member-1',
  actorName: 'admin',
  actionType: 'project',
  action: 'created',
  entityType: 'project',
  entityId: 'proj-1',
  details: { method: 'POST', path: '/admin/projects' },
  ipAddress: '192.168.1.1',
  severity: 'info',
  userAgent: 'jest',
  ...overrides,
});

describe('AuditService', () => {
  let service: AuditService;
  let repo: {
    insert: jest.Mock;
    findPaginated: jest.Mock;
    deleteOlderThan: jest.Mock;
  };
  let redis: {
    isAvailable: boolean;
    hGetAll: jest.Mock;
    hIncrBy: jest.Mock;
    expire: jest.Mock;
  };
  let discord: { isBotReady: jest.Mock; getClient: jest.Mock };
  let pool: { query: jest.Mock };

  beforeEach(async () => {
    repo = {
      insert: jest.fn().mockResolvedValue(undefined),
      findPaginated: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      deleteOlderThan: jest.fn().mockResolvedValue(0),
    };
    redis = {
      isAvailable: true,
      hGetAll: jest.fn().mockResolvedValue({}),
      hIncrBy: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(undefined),
    };
    discord = {
      isBotReady: jest.fn().mockReturnValue(false),
      getClient: jest.fn(),
    };
    pool = { query: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: repo },
        { provide: RedisService, useValue: redis },
        { provide: DiscordService, useValue: discord },
        { provide: DATABASE_POOL, useValue: pool },
      ],
    }).compile();
    service = mod.get(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getAuditLogs', () => {
    it('maps rows to the API shape and forwards filters', async () => {
      repo.findPaginated.mockResolvedValue({ rows: [fakeRow()], total: 1 });
      const dto = {
        dateFrom: '2026-03-01T00:00:00Z',
        dateTo: '2026-04-01T00:00:00Z',
        actorId: 'member-1',
        actionType: 'project',
        severity: 'info',
        limit: 50,
        offset: 0,
      } as any;

      const result = await service.getAuditLogs(dto);

      expect(repo.findPaginated).toHaveBeenCalledWith({
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
        actorId: dto.actorId,
        actionType: dto.actionType,
        severity: dto.severity,
        limit: 50,
        offset: 0,
      });
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.logs[0]).toMatchObject({
        id: 1,
        timestamp: '2026-04-01T12:00:00.000Z',
        actorId: 'member-1',
        actionType: 'project',
        action: 'created',
      });
      // userAgent is internal and must not leak into the API shape
      expect(result.logs[0]).not.toHaveProperty('userAgent');
    });
  });

  describe('getAuditLogsCsv', () => {
    it('returns a CSV with header + rows, blanking nulls, and caps the export', async () => {
      repo.findPaginated.mockResolvedValue({
        rows: [
          fakeRow({
            actorId: null,
            actorName: null,
            entityId: null,
            details: null,
            ipAddress: null,
          }),
        ],
        total: 1,
      });

      const csv = await service.getAuditLogsCsv({
        limit: 50,
        offset: 0,
      } as any);

      const [header, row] = csv.split('\n');
      expect(header).toBe(
        'id,timestamp,actorId,actorName,actionType,action,entityType,entityId,details,ipAddress,severity',
      );
      expect(
        row.startsWith(
          '1,2026-04-01T12:00:00.000Z,,,project,created,project,,,,info',
        ),
      ).toBe(true);
      // export uses the bounded cap, not the dto limit
      expect(repo.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10_000, offset: 0 }),
      );
    });

    it('serialises the details object into the CSV cell', async () => {
      repo.findPaginated.mockResolvedValue({ rows: [fakeRow()], total: 1 });
      const csv = await service.getAuditLogsCsv({
        limit: 50,
        offset: 0,
      } as any);
      expect(csv).toContain('"{""method"":""POST""');
    });
  });

  describe('logAction', () => {
    it('delegates to the repository', () => {
      service.logAction({
        actionType: 'auth',
        action: 'login',
        entityType: 'session',
      });
      expect(repo.insert).toHaveBeenCalled();
    });

    it('swallows repository errors', async () => {
      repo.insert.mockRejectedValue(new Error('db down'));
      expect(() =>
        service.logAction({
          actionType: 'auth',
          action: 'login',
          entityType: 'session',
        }),
      ).not.toThrow();
      await Promise.resolve();
    });
  });

  describe('getHealthStatus', () => {
    it('reports all services healthy when reachable', async () => {
      pool.query.mockResolvedValue({ rows: [{ connections: '7' }] });
      redis.isAvailable = true;
      discord.isBotReady.mockReturnValue(true);
      discord.getClient.mockReturnValue({
        guilds: { cache: { size: 3 } },
        ws: { ping: 42 },
      });

      const health = await service.getHealthStatus();

      expect(health.api.status).toBe('healthy');
      expect(typeof health.api.uptime).toBe('number');
      expect(health.database).toEqual({
        status: 'connected',
        queryTime: expect.any(Number),
        connections: 7,
      });
      expect(health.redis.status).toBe('connected');
      expect(health.discord).toEqual({
        status: 'connected',
        guilds: 3,
        latency: 42,
      });
    });

    it('reports disconnected services when unreachable', async () => {
      pool.query.mockRejectedValue(new Error('no db'));
      redis.isAvailable = false;
      discord.isBotReady.mockReturnValue(false);

      const health = await service.getHealthStatus();

      expect(health.database).toEqual({
        status: 'disconnected',
        queryTime: -1,
        connections: 0,
      });
      expect(health.redis.status).toBe('disconnected');
      expect(health.discord).toEqual({
        status: 'disconnected',
        guilds: 0,
        latency: -1,
      });
    });
  });

  describe('getUsageStats', () => {
    const wireRedis = () =>
      redis.hGetAll.mockImplementation((key: string) => {
        if (key.endsWith(':total')) return Promise.resolve({ count: '10' });
        if (key.endsWith(':endpoints'))
          return Promise.resolve({ 'GET:/admin/projects': '4' });
        if (key.endsWith(':errors'))
          return Promise.resolve({ '404': '2', '500': '1' });
        if (key.endsWith(':projects'))
          return Promise.resolve({ 'proj-1': '5' });
        return Promise.resolve({});
      });

    it('aggregates counters across the 7-day window', async () => {
      wireRedis();
      const stats = await service.getUsageStats({ period: '7d' } as any);

      expect(stats.totalRequests).toBe(70);
      expect(stats.byEndpoint).toEqual([
        {
          endpoint: '/admin/projects',
          method: 'GET',
          count: 28,
          avgResponseTime: 0,
        },
      ]);
      expect(stats.byProject).toEqual([
        { projectId: 'proj-1', projectName: 'proj-1', requests: 35, errors: 0 },
      ]);
      expect(stats.errors).toEqual({
        total: 21,
        byType: { '4xx': 14, '5xx': 7 },
      });
      // 4 hashes read per day
      expect(redis.hGetAll).toHaveBeenCalledTimes(28);
    });

    it('honours the projectId filter', async () => {
      wireRedis();
      const stats = await service.getUsageStats({
        period: '7d',
        projectId: 'other',
      } as any);
      expect(stats.byProject).toEqual([]);
    });

    it('defaults to a 30-day window', async () => {
      await service.getUsageStats({ period: '30d' } as any);
      expect(redis.hGetAll).toHaveBeenCalledTimes(120);
    });

    it('supports the 90-day window', async () => {
      await service.getUsageStats({ period: '90d' } as any);
      expect(redis.hGetAll).toHaveBeenCalledTimes(360);
    });
  });

  describe('recordUsage', () => {
    it('increments total + endpoint counters and sets TTLs', async () => {
      await service.recordUsage('POST', '/admin/projects', 201);
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':total'),
        'count',
        1,
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':endpoints'),
        'POST:/admin/projects',
        1,
      );
      expect(redis.hIncrBy).not.toHaveBeenCalledWith(
        expect.stringContaining(':errors'),
        expect.anything(),
        expect.anything(),
      );
      expect(redis.expire).toHaveBeenCalledTimes(3);
    });

    it('records an error counter for 4xx/5xx', async () => {
      await service.recordUsage('GET', '/admin/x', 404);
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':errors'),
        '404',
        1,
      );
    });

    it('normalises id-bearing path segments to keep cardinality bounded', async () => {
      await service.recordUsage(
        'DELETE',
        '/admin/servers/123456789012345678',
        200,
      );
      await service.recordUsage(
        'PATCH',
        '/admin/projects/123e4567-e89b-42d3-a456-426614174000',
        200,
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':endpoints'),
        'DELETE:/admin/servers/:id',
        1,
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':endpoints'),
        'PATCH:/admin/projects/:id',
        1,
      );
    });
  });

  describe('cleanupOldLogs (90-day retention)', () => {
    it('deletes entries older than ~90 days and returns the count', async () => {
      repo.deleteOlderThan.mockResolvedValue(5);
      const deleted = await service.cleanupOldLogs();

      expect(deleted).toBe(5);
      const cutoff = repo.deleteOlderThan.mock.calls[0][0] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      const ageDays = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(ageDays).toBeGreaterThan(89.9);
      expect(ageDays).toBeLessThan(90.1);
    });

    it('returns 0 when nothing is purged', async () => {
      repo.deleteOlderThan.mockResolvedValue(0);
      expect(await service.cleanupOldLogs()).toBe(0);
    });
  });

  describe('cleanup scheduler', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      service.stopCleanupSchedule();
      jest.useRealTimers();
    });

    it('runs cleanup on the interval and is idempotent on start', () => {
      service.startCleanupSchedule();
      service.startCleanupSchedule(); // second call must not add a timer
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(CLEANUP_INTERVAL_MS);
      expect(repo.deleteOlderThan).toHaveBeenCalledTimes(1);
    });

    it('stops the timer', () => {
      service.startCleanupSchedule();
      service.stopCleanupSchedule();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('survives a failing cleanup tick', () => {
      repo.deleteOlderThan.mockRejectedValue(new Error('boom'));
      service.startCleanupSchedule();
      expect(() => jest.advanceTimersByTime(CLEANUP_INTERVAL_MS)).not.toThrow();
    });
  });
});
