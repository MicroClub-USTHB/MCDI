import { Test } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';
import { RedisService } from '../../common/redis/redis.service';
import { DiscordService } from '../discord/discord.service';
import { ProjectsService } from '../projects/projects.service';
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
    info: jest.Mock;
  };
  let discord: { isBotReady: jest.Mock; getClient: jest.Mock };
  let projects: { findAll: jest.Mock };
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
      info: jest.fn().mockResolvedValue(null),
    };
    discord = {
      isBotReady: jest.fn().mockReturnValue(false),
      getClient: jest.fn(),
    };
    projects = { findAll: jest.fn().mockResolvedValue([]) };
    pool = { query: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: repo },
        { provide: RedisService, useValue: redis },
        { provide: DiscordService, useValue: discord },
        { provide: ProjectsService, useValue: projects },
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

  describe('getAuthFailures', () => {
    it('pins the auth/warning filter and lifts reason, attempted actor and path out of details', async () => {
      repo.findPaginated.mockResolvedValue({
        rows: [
          fakeRow({
            id: 7,
            actorId: null,
            actionType: 'auth',
            action: 'api_key_rejected',
            severity: 'warning',
            ipAddress: '203.0.113.7',
            details: {
              reason: 'Invalid API key',
              method: 'GET',
              path: '/members/1',
              attemptedActor: 'pk_abc123',
            },
          }),
          fakeRow({
            id: 8,
            actionType: 'auth',
            severity: 'warning',
            details: null,
          }),
        ],
        total: 2,
      });

      const result = await service.getAuthFailures({
        dateFrom: '2026-03-01T00:00:00Z',
        limit: 20,
        offset: 5,
      } as any);

      expect(repo.findPaginated).toHaveBeenCalledWith({
        dateFrom: '2026-03-01T00:00:00Z',
        dateTo: undefined,
        actionType: 'auth',
        severity: 'warning',
        limit: 20,
        offset: 5,
      });
      expect(result).toMatchObject({ total: 2, limit: 20, offset: 5 });
      expect(result.failures[0]).toEqual({
        id: 7,
        timestamp: '2026-04-01T12:00:00.000Z',
        ipAddress: '203.0.113.7',
        reason: 'Invalid API key',
        attemptedActor: 'pk_abc123',
        actorId: null,
        path: '/members/1',
      });
      expect(result.failures[1]).toMatchObject({
        id: 8,
        reason: null,
        attemptedActor: null,
        path: null,
      });
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
      redis.info.mockImplementation((section: string) =>
        Promise.resolve(
          section === 'stats'
            ? '# Stats\r\nkeyspace_hits:30\r\nkeyspace_misses:10\r\n'
            : '# Memory\r\nused_memory:1572864\r\nused_memory_human:1.50M\r\n',
        ),
      );
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
      expect(health.redis).toEqual({
        status: 'connected',
        hitRate: 0.75,
        memoryUsed: '1.50M',
      });
      expect(health.discord).toEqual({
        status: 'connected',
        guilds: 3,
        latency: 42,
      });
    });

    it('reports a zero hit rate and unknown memory when INFO has nothing usable', async () => {
      redis.isAvailable = true;
      redis.info.mockImplementation((section: string) =>
        Promise.resolve(
          section === 'stats' ? 'keyspace_hits:0\r\nkeyspace_misses:0' : null,
        ),
      );

      const health = await service.getHealthStatus();

      expect(health.redis).toEqual({
        status: 'connected',
        hitRate: 0,
        memoryUsed: 'unknown',
      });
    });

    it('reports disconnected when INFO cannot be read at all', async () => {
      redis.isAvailable = true;
      redis.info.mockResolvedValue(null);

      const health = await service.getHealthStatus();

      expect(health.redis).toEqual({
        status: 'disconnected',
        hitRate: 0,
        memoryUsed: 'unknown',
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
      expect(health.redis).toEqual({
        status: 'disconnected',
        hitRate: 0,
        memoryUsed: 'unknown',
      });
      expect(redis.info).not.toHaveBeenCalled();
      expect(health.discord).toEqual({
        status: 'disconnected',
        guilds: 0,
        latency: -1,
      });
    });
  });

  describe('getUsageStats', () => {
    const wireRedis = () => {
      redis.hGetAll.mockImplementation((key: string) => {
        if (key.endsWith(':total')) return Promise.resolve({ count: '10' });
        if (key.endsWith(':endpoints'))
          return Promise.resolve({ 'GET:/admin/projects': '4' });
        if (key.endsWith(':durations'))
          return Promise.resolve({ 'GET:/admin/projects': '62' });
        if (key.endsWith(':errors'))
          return Promise.resolve({ '404': '2', '500': '1' });
        if (key.endsWith(':projects'))
          return Promise.resolve({ 'proj-1': '5', 'proj-2': '2' });
        if (key.endsWith(':project_errors'))
          return Promise.resolve({ 'proj-1': '1' });
        return Promise.resolve({});
      });
      projects.findAll.mockResolvedValue([{ id: 'proj-1', name: 'Proj One' }]);
    };

    it('aggregates counters across the 7-day window', async () => {
      wireRedis();
      const stats = await service.getUsageStats({ period: '7d' } as any);

      expect(stats.totalRequests).toBe(70);
      // 434ms over 28 requests rounds to 16
      expect(stats.byEndpoint).toEqual([
        {
          endpoint: '/admin/projects',
          method: 'GET',
          count: 28,
          avgResponseTime: 16,
        },
      ]);
      // unknown project ids keep the id as the display name
      expect(stats.byProject).toEqual([
        {
          projectId: 'proj-1',
          projectName: 'Proj One',
          requests: 35,
          errors: 7,
        },
        { projectId: 'proj-2', projectName: 'proj-2', requests: 14, errors: 0 },
      ]);
      expect(stats.errors).toEqual({
        total: 21,
        byType: { '4xx': 14, '5xx': 7 },
      });
      // 6 hashes read per day
      expect(redis.hGetAll).toHaveBeenCalledTimes(42);
    });

    it('honours the projectId filter for requests and errors', async () => {
      wireRedis();
      const stats = await service.getUsageStats({
        period: '7d',
        projectId: 'proj-1',
      } as any);
      expect(stats.byProject).toEqual([
        {
          projectId: 'proj-1',
          projectName: 'Proj One',
          requests: 35,
          errors: 7,
        },
      ]);
    });

    it('skips the name lookup when no project matches', async () => {
      wireRedis();
      const stats = await service.getUsageStats({
        period: '7d',
        projectId: 'other',
      } as any);
      expect(stats.byProject).toEqual([]);
      expect(projects.findAll).not.toHaveBeenCalled();
    });

    it('averages only over requests that have a recorded duration', async () => {
      const oldest = new Date();
      oldest.setDate(oldest.getDate() - 6);
      const oldestKey = oldest.toISOString().slice(0, 10);
      redis.hGetAll.mockImplementation((key: string) => {
        if (key.endsWith(':endpoints'))
          return Promise.resolve({ 'GET:/admin/projects': '4' });
        if (key.endsWith(':durations'))
          return Promise.resolve(
            key.includes(oldestKey) ? {} : { 'GET:/admin/projects': '60' },
          );
        return Promise.resolve({});
      });

      const stats = await service.getUsageStats({ period: '7d' } as any);

      // 360ms over the 24 timed requests; the untimed day is excluded
      expect(stats.byEndpoint).toEqual([
        {
          endpoint: '/admin/projects',
          method: 'GET',
          count: 28,
          avgResponseTime: 15,
        },
      ]);
    });

    it('defaults to a 30-day window', async () => {
      await service.getUsageStats({ period: '30d' } as any);
      expect(redis.hGetAll).toHaveBeenCalledTimes(180);
    });

    it('supports the 90-day window', async () => {
      await service.getUsageStats({ period: '90d' } as any);
      expect(redis.hGetAll).toHaveBeenCalledTimes(540);
    });
  });

  describe('recordUsage', () => {
    it('increments total, endpoint, duration and project counters and sets TTLs', async () => {
      await service.recordUsage('POST', '/admin/projects', 201, 12, 'proj-1');
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
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':durations'),
        'POST:/admin/projects',
        12,
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':projects'),
        'proj-1',
        1,
      );
      expect(redis.hIncrBy).not.toHaveBeenCalledWith(
        expect.stringContaining(':errors'),
        expect.anything(),
        expect.anything(),
      );
      expect(redis.hIncrBy).not.toHaveBeenCalledWith(
        expect.stringContaining(':project_errors'),
        expect.anything(),
        expect.anything(),
      );
      expect(redis.expire).toHaveBeenCalledTimes(4);
    });

    it('records error counters per status and per project for 4xx/5xx', async () => {
      await service.recordUsage('GET', '/admin/x', 404, 5, 'proj-1');
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':errors'),
        '404',
        1,
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':project_errors'),
        'proj-1',
        1,
      );
    });

    it('skips the project hashes when no project is attached', async () => {
      await service.recordUsage('POST', '/auth/validate', 401, 3);
      expect(redis.hIncrBy).not.toHaveBeenCalledWith(
        expect.stringMatching(/:(projects|project_errors)$/),
        expect.anything(),
        expect.anything(),
      );
      expect(redis.hIncrBy).toHaveBeenCalledWith(
        expect.stringContaining(':durations'),
        'POST:/auth/validate',
        3,
      );
    });

    it('normalises id-bearing path segments to keep cardinality bounded', async () => {
      await service.recordUsage(
        'DELETE',
        '/admin/servers/123456789012345678',
        200,
        0,
      );
      await service.recordUsage(
        'PATCH',
        '/admin/projects/123e4567-e89b-42d3-a456-426614174000',
        200,
        0,
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
