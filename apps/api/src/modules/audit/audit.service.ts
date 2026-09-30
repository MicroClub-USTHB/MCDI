import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';
import { RedisService } from '../../common/redis/redis.service';
import { DiscordService } from '../discord/discord.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditRepository, InsertAuditLog } from './audit.repository';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QueryAuthFailuresDto } from './dto/query-auth-failures.dto';
import { QueryUsageDto } from './dto/query-usage.dto';
import { toCsv } from '../../common/utils/csv.util';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 90;
const MAX_EXPORT_ROWS = 10_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Collapse id-bearing path segments (Discord snowflakes, UUIDs) to ":id" so the
// per-endpoint usage hash stays bounded instead of growing one field per id.
function normalizePath(path: string): string {
  return path
    .split('/')
    .map((seg) => (/^\d{5,}$/.test(seg) || UUID_RE.test(seg) ? ':id' : seg))
    .join('/');
}

// INFO replies are "field:value" lines; "#" lines are section headers.
function parseRedisInfo(raw: string | null): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!raw) return fields;
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    fields[line.slice(0, sep)] = line.slice(sep + 1);
  }
  return fields;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly redisService: RedisService,
    private readonly discordService: DiscordService,
    private readonly projectsService: ProjectsService,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  // ── Audit Logs ────────────────────────────────────────────────────────

  async getAuditLogs(dto: QueryAuditLogsDto) {
    const { rows, total } = await this.auditRepository.findPaginated({
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      actorId: dto.actorId,
      actionType: dto.actionType,
      severity: dto.severity,
      limit: dto.limit,
      offset: dto.offset,
    });

    return {
      logs: rows.map((r) => ({
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        actorId: r.actorId,
        actorName: r.actorName,
        actionType: r.actionType,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        details: r.details,
        ipAddress: r.ipAddress,
        severity: r.severity,
      })),
      total,
      limit: dto.limit,
      offset: dto.offset,
    };
  }

  async getAuditLogsCsv(dto: QueryAuditLogsDto): Promise<string> {
    const { rows } = await this.auditRepository.findPaginated({
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      actorId: dto.actorId,
      actionType: dto.actionType,
      severity: dto.severity,
      limit: MAX_EXPORT_ROWS,
      offset: 0,
    });

    return toCsv(
      rows.map((r) => ({
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        actorId: r.actorId ?? '',
        actorName: r.actorName ?? '',
        actionType: r.actionType,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId ?? '',
        details: r.details ? JSON.stringify(r.details) : '',
        ipAddress: r.ipAddress ?? '',
        severity: r.severity,
      })),
    );
  }

  logAction(entry: InsertAuditLog): void {
    this.auditRepository.insert(entry).catch((err: Error) => {
      this.logger.warn(`Failed to write audit log: ${err.message}`);
    });
  }

  // Failed logins, rejected sessions and rejected API keys are the 'auth'
  // rows written with severity 'warning'; successful logins and logouts are
  // 'info' and stay out of this view.
  async getAuthFailures(dto: QueryAuthFailuresDto) {
    const { rows, total } = await this.auditRepository.findPaginated({
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      actionType: 'auth',
      severity: 'warning',
      limit: dto.limit,
      offset: dto.offset,
    });

    const text = (value: unknown) => (typeof value === 'string' ? value : null);

    return {
      failures: rows.map((r) => ({
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        ipAddress: r.ipAddress,
        reason: text(r.details?.reason),
        attemptedActor: text(r.details?.attemptedActor),
        actorId: r.actorId,
        path: text(r.details?.path),
      })),
      total,
      limit: dto.limit,
      offset: dto.offset,
    };
  }

  // ── Health Check ──────────────────────────────────────────────────────

  async getHealthStatus() {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const discordHealth = this.checkDiscord();

    return {
      api: {
        status: 'healthy' as const,
        uptime: Math.floor(process.uptime()),
        responseTime: 0, // filled by controller timing
      },
      database: dbHealth,
      redis: redisHealth,
      discord: discordHealth,
    };
  }

  private async checkDatabase() {
    try {
      const start = Date.now();
      const result = await this.pool.query(
        'SELECT count(*) AS connections FROM pg_stat_activity WHERE datname = current_database()',
      );
      const queryTime = Date.now() - start;
      const row = result.rows[0] as { connections: string } | undefined;
      return {
        status: 'connected' as const,
        queryTime,
        connections: parseInt(row?.connections ?? '0', 10),
      };
    } catch {
      return { status: 'disconnected' as const, queryTime: -1, connections: 0 };
    }
  }

  private async checkRedis() {
    if (!this.redisService.isAvailable) {
      return {
        status: 'disconnected' as const,
        hitRate: 0,
        memoryUsed: 'unknown',
      };
    }

    const [stats, memory] = await Promise.all([
      this.redisService.info('stats'),
      this.redisService.info('memory'),
    ]);
    if (stats === null && memory === null) {
      return {
        status: 'disconnected' as const,
        hitRate: 0,
        memoryUsed: 'unknown',
      };
    }

    const statFields = parseRedisInfo(stats);
    const hits = Number(statFields.keyspace_hits ?? 0);
    const misses = Number(statFields.keyspace_misses ?? 0);
    const lookups = hits + misses;

    return {
      status: 'connected' as const,
      hitRate: lookups > 0 ? hits / lookups : 0,
      memoryUsed: parseRedisInfo(memory).used_memory_human ?? 'unknown',
    };
  }

  private checkDiscord() {
    if (!this.discordService.isBotReady()) {
      return {
        status: 'disconnected' as const,
        guilds: 0,
        latency: -1,
      };
    }
    const client = this.discordService.getClient();
    return {
      status: 'connected' as const,
      guilds: client.guilds.cache.size,
      latency: client.ws.ping,
    };
  }

  // ── Usage Stats ───────────────────────────────────────────────────────

  async getUsageStats(dto: QueryUsageDto) {
    const days = this.periodToDays(dto.period);
    const now = new Date();

    let totalRequests = 0;
    const endpointCounts: Record<string, number> = {};
    const endpointDurations: Record<string, number> = {};
    const timedCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};
    const projectErrorCounts: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const prefix = `mcdi:usage:daily:${dateKey}`;

      const [
        endpoints,
        durations,
        projects,
        projectErrors,
        errors,
        dailyTotal,
      ] = await Promise.all([
        this.redisService.hGetAll(`${prefix}:endpoints`),
        this.redisService.hGetAll(`${prefix}:durations`),
        this.redisService.hGetAll(`${prefix}:projects`),
        this.redisService.hGetAll(`${prefix}:project_errors`),
        this.redisService.hGetAll(`${prefix}:errors`),
        this.redisService.hGetAll(`${prefix}:total`),
      ]);

      const dayTotal = parseInt(dailyTotal?.count ?? '0', 10);
      totalRequests += dayTotal;

      for (const [key, val] of Object.entries(endpoints)) {
        endpointCounts[key] = (endpointCounts[key] ?? 0) + parseInt(val, 10);
        // Days missing a durations hash predate tracking and are not averaged.
        if (key in durations) {
          timedCounts[key] = (timedCounts[key] ?? 0) + parseInt(val, 10);
        }
      }
      for (const [key, val] of Object.entries(durations)) {
        endpointDurations[key] =
          (endpointDurations[key] ?? 0) + parseInt(val, 10);
      }
      for (const [key, val] of Object.entries(projects)) {
        if (!dto.projectId || key === dto.projectId) {
          projectCounts[key] = (projectCounts[key] ?? 0) + parseInt(val, 10);
        }
      }
      for (const [key, val] of Object.entries(projectErrors)) {
        if (!dto.projectId || key === dto.projectId) {
          projectErrorCounts[key] =
            (projectErrorCounts[key] ?? 0) + parseInt(val, 10);
        }
      }
      for (const [key, val] of Object.entries(errors)) {
        errorCounts[key] = (errorCounts[key] ?? 0) + parseInt(val, 10);
      }
    }

    const projectNames =
      Object.keys(projectCounts).length > 0
        ? await this.lookupProjectNames()
        : new Map<string, string>();
    const errorTotal = Object.values(errorCounts).reduce((a, b) => a + b, 0);
    const fourXx = Object.entries(errorCounts)
      .filter(([code]) => code.startsWith('4'))
      .reduce((a, [, v]) => a + v, 0);
    const fiveXx = Object.entries(errorCounts)
      .filter(([code]) => code.startsWith('5'))
      .reduce((a, [, v]) => a + v, 0);

    return {
      totalRequests,
      byProject: Object.entries(projectCounts).map(([projectId, requests]) => ({
        projectId,
        projectName: projectNames.get(projectId) ?? projectId,
        requests,
        errors: projectErrorCounts[projectId] ?? 0,
      })),
      byEndpoint: Object.entries(endpointCounts).map(([key, cnt]) => {
        const [method, ...rest] = key.split(':');
        const timed = timedCounts[key] ?? 0;
        return {
          endpoint: rest.join(':'),
          method: method ?? 'GET',
          count: cnt,
          avgResponseTime:
            timed > 0 ? Math.round((endpointDurations[key] ?? 0) / timed) : 0,
        };
      }),
      errors: { total: errorTotal, byType: { '4xx': fourXx, '5xx': fiveXx } },
    };
  }

  // Loads the whole projects table in one query because the table is small.
  // Unknown ids fall back to the id so a failed lookup cannot turn the
  // Redis-backed stats into a 500.
  private async lookupProjectNames(): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    try {
      for (const project of await this.projectsService.findAll()) {
        names.set(project.id, project.name);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to resolve project names for usage stats: ${(err as Error).message}`,
      );
    }
    return names;
  }

  async recordUsage(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    projectId?: string,
  ): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const prefix = `mcdi:usage:daily:${dateKey}`;
    const ttl = (RETENTION_DAYS + 1) * 24 * 60 * 60;
    const endpointKey = `${method}:${normalizePath(path)}`;
    const isError = statusCode >= 400;
    // HINCRBY only accepts integers; a NaN or negative duration is a caller bug.
    const duration = Number.isFinite(durationMs)
      ? Math.max(0, Math.round(durationMs))
      : 0;

    const increments: [key: string, field: string, by: number][] = [
      [`${prefix}:total`, 'count', 1],
      [`${prefix}:endpoints`, endpointKey, 1],
      [`${prefix}:durations`, endpointKey, duration],
    ];
    if (isError) {
      increments.push([`${prefix}:errors`, String(statusCode), 1]);
    }
    if (projectId) {
      increments.push([`${prefix}:projects`, projectId, 1]);
      if (isError) {
        increments.push([`${prefix}:project_errors`, projectId, 1]);
      }
    }

    await Promise.all(
      increments.map(([key, field, by]) =>
        this.redisService.hIncrBy(key, field, by),
      ),
    ).catch(() => {});

    // TTL once per key set (best-effort)
    for (const [key] of increments) {
      this.redisService.expire(key, ttl).catch(() => {});
    }
  }

  private periodToDays(period: string): number {
    switch (period) {
      case '7d':
        return 7;
      case '90d':
        return 90;
      default:
        return 30;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  async cleanupOldLogs(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const deleted = await this.auditRepository.deleteOlderThan(cutoff);
    if (deleted > 0) {
      this.logger.log(
        `Audit log cleanup: removed ${deleted} entries older than ${RETENTION_DAYS} days`,
      );
    }
    return deleted;
  }

  startCleanupSchedule(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldLogs().catch((err: Error) => {
        this.logger.warn(`Audit cleanup failed: ${err.message}`);
      });
    }, CLEANUP_INTERVAL_MS);
    this.logger.log('Audit log cleanup scheduled (every 24h)');
  }

  stopCleanupSchedule(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
