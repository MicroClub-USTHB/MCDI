import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { DiscordService } from '../discord/discord.service';
import { toCsv } from '../../common/utils/csv.util';
import { StatsRepository } from './stats.repository';
import { SettingsService } from '../admin-settings/settings.service';
import {
  ExportStatsQueryDto,
  GrowthQueryDto,
  MemberStatsQueryDto,
  RoleStatsQueryDto,
} from './dto/stats-query.dto';

const DAILY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const GRANULARITY_UNIT: Record<string, 'day' | 'week' | 'month'> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
};

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly keyPrefix: string;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly repo: StatsRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
    private readonly settings: SettingsService,
  ) {
    this.keyPrefix =
      this.configService.get<string>('redis.keyPrefix') || 'mcdi';

    // Mirror PermissionCacheService: a shortened stats TTL doesn't re-expire
    // entries already cached, so flush the stats namespace on a decrease.
    this.settings.registerChangeListener(async (changes) => {
      const ttl = changes.find((c) => c.key === 'statsCacheTtlMs');
      if (ttl && ttl.to < ttl.from) {
        await this.clearCache();
      }
    });
  }

  /** Flush every cached stats payload. */
  private async clearCache(): Promise<void> {
    const keys = await this.redisService.scanKeys(`${this.namespace()}:*`);
    await this.redisService.delete(...keys);
    if (keys.length > 0) {
      this.logger.debug(`Stats cache: flushed ${keys.length} entries`);
    }
  }

  /** Stats-cache TTL, read live from SettingsService. */
  private get ttlMs(): number {
    return this.settings.getStatsCacheTtlMs();
  }

  /** "Active member" window in days, read live from SettingsService. */
  private get activityThresholdDays(): number {
    return this.settings.getMemberActivityThresholdDays();
  }

  /** A member is "active" if their server presence was reconfirmed by sync
   *  (or, absent that, they joined) within the configured threshold. */
  private activeCutoff(): Date {
    return new Date(
      Date.now() - this.activityThresholdDays * 24 * 60 * 60 * 1000,
    );
  }

  // ── Member statistics ───────────────────────────────────────────────────

  async getMemberStats(dto: MemberStatsQueryDto) {
    const key = `${this.namespace()}:members:${dto.serverId ?? 'all'}:${dto.dateRange}`;
    return this.cached(key, () => this.computeMemberStats(dto));
  }

  private async computeMemberStats(dto: MemberStatsQueryDto) {
    const serverId = dto.serverId;
    const since = this.cutoff(dto.dateRange);
    const activeCutoff = this.activeCutoff();
    const [total, club, active, newMembers, byServerRows, byRoleRows] =
      await Promise.all([
        this.repo.countMembers(serverId),
        this.repo.countClubMembers(serverId),
        this.repo.countActiveMembers(activeCutoff, serverId),
        this.repo.countNewMembers(since, serverId),
        this.repo.membersByServer(serverId),
        this.repo.membersByRole(serverId),
      ]);

    return {
      totalMembers: total,
      clubMembers: club,
      nonClubMembers: total - club,
      activeMembers: active,
      inactiveMembers: total - active,
      // Members are "active" if resynced (or, absent that, joined) within
      // this many days — see MEMBER_ACTIVITY_THRESHOLD_DAYS.
      activityThresholdDays: this.activityThresholdDays,
      newMembersThisPeriod: newMembers,
      // Growth relative to the pre-period baseline.
      growthRate: round2((newMembers / Math.max(1, total - newMembers)) * 100),
      byRole: byRoleRows.map((r) => ({
        roleName: r.roleName,
        count: r.count,
        percentage: round2((r.count / Math.max(1, total)) * 100),
      })),
      byServer: byServerRows.map((r) => ({
        serverId: r.serverId,
        serverName: r.serverName,
        memberCount: r.memberCount,
      })),
    };
  }

  // ── Member growth over time ─────────────────────────────────────────────

  async getMemberGrowth(dto: GrowthQueryDto) {
    const key = `${this.namespace()}:growth:${dto.serverId ?? 'all'}:${dto.period}:${dto.granularity}`;
    return this.cached(key, () => this.computeMemberGrowth(dto));
  }

  private async computeMemberGrowth(dto: GrowthQueryDto) {
    const since = this.cutoff(dto.period);
    const unit = GRANULARITY_UNIT[dto.granularity] ?? 'day';

    const [membersBefore, departuresBefore, growthBuckets, departureBuckets] =
      await Promise.all([
        this.repo.countMembersBefore(since, dto.serverId),
        this.repo.countDeparturesBefore(since, dto.serverId),
        this.repo.memberGrowthBuckets(since, unit, dto.serverId),
        this.repo.memberDepartureBuckets(since, unit, dto.serverId),
      ]);

    const baseline = Math.max(0, membersBefore - departuresBefore);

    const bucketMap = new Map<
      string,
      { newMembers: number; leftMembers: number }
    >();

    for (const b of growthBuckets) {
      const d = new Date(b.bucket).toISOString();
      const entry = bucketMap.get(d) ?? { newMembers: 0, leftMembers: 0 };
      entry.newMembers = b.newMembers;
      bucketMap.set(d, entry);
    }

    for (const b of departureBuckets) {
      const d = new Date(b.bucket).toISOString();
      const entry = bucketMap.get(d) ?? { newMembers: 0, leftMembers: 0 };
      entry.leftMembers = b.leftMembers;
      bucketMap.set(d, entry);
    }

    const sortedDates = Array.from(bucketMap.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    let running = baseline;
    let totalGrowth = 0;
    const data = sortedDates.map((dateStr) => {
      const b = bucketMap.get(dateStr)!;
      running += b.newMembers - b.leftMembers;
      totalGrowth += b.newMembers - b.leftMembers;
      return {
        date: dateStr,
        count: running,
        newMembers: b.newMembers,
        leftMembers: b.leftMembers,
      };
    });

    return {
      data,
      period: dto.period,
      totalGrowth,
      trend: trendDirection(data.map((d) => d.newMembers)),
    };
  }

  // ── Role distribution ───────────────────────────────────────────────────

  async getRoleStats(dto: RoleStatsQueryDto) {
    const key = `${this.namespace()}:roles:${dto.serverId ?? 'all'}`;
    return this.cached(key, () => this.computeRoleStats(dto));
  }

  private async computeRoleStats(dto: RoleStatsQueryDto) {
    if (dto.serverId) {
      const [serverName, rows, totalMembers] = await Promise.all([
        this.repo.serverName(dto.serverId),
        this.repo.roleDistribution(dto.serverId),
        this.repo.countMembers(dto.serverId),
      ]);

      return {
        serverId: dto.serverId,
        serverName,
        scope: 'server' as const,
        roles: rows.map((r) => ({
          roleId: r.roleId,
          roleName: r.roleName,
          memberCount: r.memberCount,
          percentage: round2((r.memberCount / Math.max(1, totalMembers)) * 100),
          hierarchyLevel: r.hierarchyLevel,
          color: r.color,
        })),
        totalMembers,
      };
    }

    const [rows, totalMembers] = await Promise.all([
      this.repo.globalRoleDistribution(),
      this.repo.countMembers(),
    ]);

    return {
      serverId: null,
      serverName: null,
      scope: 'global' as const,
      roles: rows.map((r) => ({
        roleName: r.roleName,
        memberCount: r.memberCount,
      })),
      totalMembers,
    };
  }

  // ── Server-level overview ───────────────────────────────────────────────

  async getServerStats() {
    const key = `${this.namespace()}:servers`;
    return this.cached(key, () => this.computeServerStats());
  }

  private async computeServerStats() {
    const [
      serverList,
      memberCounts,
      roleCounts,
      latestAttempts,
      latestSuccesses,
      totalServers,
      totalMembers,
    ] = await Promise.all([
      this.repo.listServers(),
      this.repo.memberCountsByServer(this.activeCutoff()),
      this.repo.roleCountsByServer(),
      this.repo.latestSyncByServer(),
      this.repo.latestSuccessfulSyncByServer(),
      this.repo.countServers(),
      this.repo.countMembers(),
    ]);

    const memberById = new Map(memberCounts.map((m) => [m.serverId, m]));
    const roleById = new Map(roleCounts.map((r) => [r.serverId, r.roleCount]));
    const latestAttemptById = new Map(
      latestAttempts.map((s) => [s.serverId, s]),
    );
    const latestSuccessById = new Map(
      latestSuccesses.map((s) => [s.serverId, s]),
    );

    const serverStats = serverList.map((s) => {
      const mc = memberById.get(s.serverId);
      const attempt = latestAttemptById.get(s.serverId);
      const success = latestSuccessById.get(s.serverId);
      return {
        serverId: s.serverId,
        serverName: s.serverName,
        memberCount: mc?.memberCount ?? 0,
        activeMembers: mc?.activeMembers ?? 0,
        roleCount: roleById.get(s.serverId) ?? 0,
        // Last *successful* sync — may lag behind the latest attempt.
        lastSync: success?.finishedAt ? success.finishedAt.toISOString() : null,
        syncStatus: attempt?.status ?? 'never',
        lastSyncError:
          attempt?.status === 'failure' ? (attempt.message ?? null) : null,
        botStatus: this.discordService.hasGuildConnection(s.serverId)
          ? ('online' as const)
          : ('offline' as const),
      };
    });

    return { servers: serverStats, totalServers, totalMembers };
  }

  // ── Cross-server overlap ────────────────────────────────────────────────

  async getCrossServerStats() {
    const key = `${this.namespace()}:cross-server`;
    return this.cached(key, () => this.computeCrossServerStats());
  }

  private async computeCrossServerStats() {
    const [membersInMultipleServers, overlapRows] = await Promise.all([
      this.repo.countMembersInMultipleServers(),
      this.repo.serverOverlapPairs(),
    ]);

    return {
      membersInMultipleServers,
      overlaps: overlapRows.map((o) => ({
        serverAId: o.serverAId,
        serverAName: o.serverAName,
        serverBId: o.serverBId,
        serverBName: o.serverBName,
        overlapCount: o.overlapCount,
      })),
    };
  }

  // ── Export ───────────────────────────────────────────────────────────────

  /** Exports any stats report as CSV or JSON, reusing the same cached
   *  compute methods the read endpoints use — no separate export logic to
   *  drift out of sync with the live data. */
  async exportStats(
    dto: ExportStatsQueryDto,
  ): Promise<{ content: string; contentType: string; filename: string }> {
    const { full, tabular } = await this.resolveExportData(dto);
    const timestamp = new Date().toISOString().slice(0, 10);

    if (dto.format === 'csv') {
      return {
        content: toCsv(tabular),
        contentType: 'text/csv',
        filename: `stats-${dto.type}-${timestamp}.csv`,
      };
    }

    return {
      content: JSON.stringify(full, null, 2),
      contentType: 'application/json',
      filename: `stats-${dto.type}-${timestamp}.json`,
    };
  }

  /** Returns both the full nested payload (for JSON) and a flattened
   *  row array (for CSV) for the requested export type. */
  private async resolveExportData(
    dto: ExportStatsQueryDto,
  ): Promise<{ full: unknown; tabular: Record<string, unknown>[] }> {
    switch (dto.type) {
      case 'members': {
        const full = await this.getMemberStats({
          serverId: dto.serverId,
          dateRange: dto.dateRange,
        });
        return { full, tabular: [full] };
      }
      case 'growth': {
        const full = await this.getMemberGrowth({
          serverId: dto.serverId,
          period: dto.dateRange,
          granularity: 'daily',
        });
        return { full, tabular: full.data };
      }
      case 'roles': {
        if (!dto.serverId) {
          throw new BadRequestException(
            'serverId is required when exporting type=roles',
          );
        }
        const full = await this.getRoleStats({ serverId: dto.serverId });
        return { full, tabular: full.roles };
      }
      case 'servers': {
        const full = await this.getServerStats();
        return { full, tabular: full.servers };
      }
      case 'cross-server': {
        const full = await this.getCrossServerStats();
        return { full, tabular: full.overlaps };
      }
      default:
        throw new BadRequestException(`Unknown export type: ${dto.type}`);
    }
  }

  // ── Daily refresh job ───────────────────────────────────────────────────

  /** Proactively recomputes the org-wide and per-server reports and
   *  re-populates the cache, so the first dashboard load of the day (or
   *  after a cache expiry) doesn't pay for a cold multi-query aggregate. */
  async refreshDailySnapshot(): Promise<void> {
    const serverList = await this.repo.listServers();

    const jobs: Promise<unknown>[] = [
      this.forceRefresh(`${this.namespace()}:members:all:30d`, () =>
        this.computeMemberStats({ serverId: undefined, dateRange: '30d' }),
      ),
      this.forceRefresh(`${this.namespace()}:servers`, () =>
        this.computeServerStats(),
      ),
      this.forceRefresh(`${this.namespace()}:cross-server`, () =>
        this.computeCrossServerStats(),
      ),
      ...serverList.flatMap((s) => [
        this.forceRefresh(`${this.namespace()}:roles:${s.serverId}`, () =>
          this.computeRoleStats({ serverId: s.serverId }),
        ),
        this.forceRefresh(
          `${this.namespace()}:growth:${s.serverId}:30d:daily`,
          () =>
            this.computeMemberGrowth({
              serverId: s.serverId,
              period: '30d',
              granularity: 'daily',
            }),
        ),
      ]),
    ];

    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(
        `Daily stats refresh: ${failed}/${results.length} reports failed to recompute`,
      );
    } else {
      this.logger.log(
        `Daily stats refresh: ${results.length} reports recomputed`,
      );
    }
  }

  startDailyRefreshSchedule(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      this.refreshDailySnapshot().catch((err: Error) => {
        this.logger.warn(`Daily stats refresh failed: ${err.message}`);
      });
    }, DAILY_REFRESH_INTERVAL_MS);
    this.logger.log('Daily stats refresh scheduled (every 24h)');
  }

  stopDailyRefreshSchedule(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private namespace(): string {
    return `${this.keyPrefix}:stats`;
  }

  private cutoff(range: string): Date {
    const days = RANGE_DAYS[range] ?? 30;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = await this.redisService.getJson<T>(key);
    if (hit !== null) {
      return hit;
    }
    const value = await compute();
    await this.redisService.setJson(key, value, this.ttlMs);
    return value;
  }

  /** Unlike `cached`, always recomputes and overwrites — used by the daily
   *  refresh job, which exists precisely to bypass a still-warm cache. */
  private async forceRefresh<T>(
    key: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    const value = await compute();
    await this.redisService.setJson(key, value, this.ttlMs);
    return value;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compares the second half of a bucketed series against the first half. */
function trendDirection(
  newMembersPerBucket: number[],
): 'increase' | 'decrease' | 'stable' {
  if (newMembersPerBucket.length < 2) return 'stable';

  const mid = Math.floor(newMembersPerBucket.length / 2);
  const firstHalf = newMembersPerBucket.slice(0, mid);
  const secondHalf = newMembersPerBucket.slice(mid);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  const firstSum = sum(firstHalf);
  const secondSum = sum(secondHalf);

  if (secondSum > firstSum) return 'increase';
  if (secondSum < firstSum) return 'decrease';
  return 'stable';
}
