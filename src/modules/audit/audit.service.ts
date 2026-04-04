import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../database/database.module';
import { RedisService } from '../../common/redis/redis.service';
import { DiscordService } from '../discord/discord.service';
import { AuditRepository, InsertAuditLog } from './audit.repository';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QueryUsageDto } from './dto/query-usage.dto';
import { toCsv } from '../../common/utils/csv.util';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 90;
const MAX_EXPORT_ROWS = 10_000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly redisService: RedisService,
    private readonly discordService: DiscordService,
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

  async logAction(entry: InsertAuditLog): Promise<void> {
    this.auditRepository.insert(entry).catch((err) => {
      this.logger.warn(`Failed to write audit log: ${err.message}`);
    });
  }

  // ── Health Check ──────────────────────────────────────────────────────

  async getHealthStatus() {
    const [dbHealth, redisHealth, discordHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDiscord(),
    ]);

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
      return {
        status: 'connected' as const,
        queryTime,
        connections: parseInt(result.rows[0]?.connections ?? '0', 10),
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
    return {
      status: 'connected' as const,
      hitRate: 0,
      memoryUsed: 'unknown',
    };
  }

  private async checkDiscord() {
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
    const projectCounts: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const prefix = `mcdi:usage:daily:${dateKey}`;

      const [endpoints, projects, errors, dailyTotal] = await Promise.all([
        this.redisService.hGetAll(`${prefix}:endpoints`),
        this.redisService.hGetAll(`${prefix}:projects`),
        this.redisService.hGetAll(`${prefix}:errors`),
        this.redisService.hGetAll(`${prefix}:total`),
      ]);

      const dayTotal = parseInt(dailyTotal?.count ?? '0', 10);
      totalRequests += dayTotal;

      for (const [key, val] of Object.entries(endpoints)) {
        endpointCounts[key] = (endpointCounts[key] ?? 0) + parseInt(val, 10);
      }
      for (const [key, val] of Object.entries(projects)) {
        if (!dto.projectId || key === dto.projectId) {
          projectCounts[key] = (projectCounts[key] ?? 0) + parseInt(val, 10);
        }
      }
      for (const [key, val] of Object.entries(errors)) {
        errorCounts[key] = (errorCounts[key] ?? 0) + parseInt(val, 10);
      }
    }

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
        projectName: projectId,
        requests,
        errors: 0,
      })),
      byEndpoint: Object.entries(endpointCounts).map(([key, cnt]) => {
        const [method, ...rest] = key.split(':');
        return {
          endpoint: rest.join(':'),
          method: method ?? 'GET',
          count: cnt,
          avgResponseTime: 0,
        };
      }),
      errors: { total: errorTotal, byType: { '4xx': fourXx, '5xx': fiveXx } },
    };
  }

  async recordUsage(
    method: string,
    path: string,
    statusCode: number,
  ): Promise<void> {
    const dateKey = new Date().toISOString().slice(0, 10);
    const prefix = `mcdi:usage:daily:${dateKey}`;
    const ttl = (RETENTION_DAYS + 1) * 24 * 60 * 60;

    const ops: Promise<unknown>[] = [
      this.redisService.hIncrBy(`${prefix}:total`, 'count', 1),
      this.redisService.hIncrBy(
        `${prefix}:endpoints`,
        `${method}:${path}`,
        1,
      ),
    ];

    if (statusCode >= 400) {
      ops.push(
        this.redisService.hIncrBy(
          `${prefix}:errors`,
          String(statusCode),
          1,
        ),
      );
    }

    await Promise.all(ops).catch(() => {});

    // TTL once per key set (best-effort)
    this.redisService.expire(`${prefix}:total`, ttl).catch(() => {});
    this.redisService.expire(`${prefix}:endpoints`, ttl).catch(() => {});
    this.redisService.expire(`${prefix}:errors`, ttl).catch(() => {});
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
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const deleted = await this.auditRepository.deleteOlderThan(cutoff);
    if (deleted > 0) {
      this.logger.log(`Audit log cleanup: removed ${deleted} entries older than ${RETENTION_DAYS} days`);
    }
    return deleted;
  }

  startCleanupSchedule(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldLogs().catch((err) => {
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
