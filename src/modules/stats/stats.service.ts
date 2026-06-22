import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { StatsRepository } from './stats.repository';
import {
  GrowthQueryDto,
  MemberStatsQueryDto,
  RoleStatsQueryDto,
} from './dto/stats-query.dto';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  private readonly ttlMs: number;
  private readonly keyPrefix: string;

  constructor(
    private readonly repo: StatsRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.ttlMs =
      this.configService.get<number>('app.statsCacheTtlMs') || DEFAULT_TTL_MS;
    this.keyPrefix =
      this.configService.get<string>('redis.keyPrefix') || 'mcdi';
  }

  // ── Member statistics ───────────────────────────────────────────────────

  async getMemberStats(dto: MemberStatsQueryDto) {
    const serverId = dto.serverId;
    const key = `${this.namespace()}:members:${serverId ?? 'all'}:${dto.dateRange}`;

    return this.cached(key, async () => {
      const since = this.cutoff(dto.dateRange);
      const [total, club, active, newMembers, byServerRows, byRoleRows] =
        await Promise.all([
          this.repo.countMembers(serverId),
          this.repo.countClubMembers(serverId),
          this.repo.countActiveMembers(serverId),
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
        newMembersThisPeriod: newMembers,
        // Growth relative to the pre-period baseline.
        growthRate: round2(
          (newMembers / Math.max(1, total - newMembers)) * 100,
        ),
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
    });
  }

  // ── Member growth over time ─────────────────────────────────────────────

  async getMemberGrowth(dto: GrowthQueryDto) {
    const key = `${this.namespace()}:growth:${dto.period}:${dto.granularity}`;

    return this.cached(key, async () => {
      const since = this.cutoff(dto.period);
      const unit = GRANULARITY_UNIT[dto.granularity] ?? 'day';

      const [baseline, buckets] = await Promise.all([
        this.repo.countMembersBefore(since),
        this.repo.memberGrowthBuckets(since, unit),
      ]);

      let running = baseline;
      let totalGrowth = 0;
      const data = buckets.map((b) => {
        running += b.newMembers;
        totalGrowth += b.newMembers;
        return {
          date: new Date(b.bucket).toISOString(),
          count: running,
          newMembers: b.newMembers,
          // Departures are not tracked in the schema yet; always 0.
          leftMembers: 0,
        };
      });

      return { data, period: dto.period, totalGrowth };
    });
  }

  // ── Role distribution ───────────────────────────────────────────────────

  async getRoleStats(dto: RoleStatsQueryDto) {
    const key = `${this.namespace()}:roles:${dto.serverId}`;

    return this.cached(key, async () => {
      const [serverName, rows, totalMembers] = await Promise.all([
        this.repo.serverName(dto.serverId),
        this.repo.roleDistribution(dto.serverId),
        this.repo.countMembers(dto.serverId),
      ]);

      return {
        serverId: dto.serverId,
        serverName,
        roles: rows.map((r) => ({
          roleId: r.roleId,
          roleName: r.roleName,
          memberCount: r.memberCount,
          hierarchyLevel: r.hierarchyLevel,
          color: r.color,
        })),
        totalMembers,
      };
    });
  }

  // ── Server-level overview ───────────────────────────────────────────────

  async getServerStats() {
    const key = `${this.namespace()}:servers`;

    return this.cached(key, async () => {
      const [
        serverList,
        memberCounts,
        roleCounts,
        syncs,
        totalServers,
        totalMembers,
      ] = await Promise.all([
        this.repo.listServers(),
        this.repo.memberCountsByServer(),
        this.repo.roleCountsByServer(),
        this.repo.latestSyncByServer(),
        this.repo.countServers(),
        this.repo.countMembers(),
      ]);

      const memberById = new Map(memberCounts.map((m) => [m.serverId, m]));
      const roleById = new Map(
        roleCounts.map((r) => [r.serverId, r.roleCount]),
      );
      const syncById = new Map(syncs.map((s) => [s.serverId, s]));

      const serverStats = serverList.map((s) => {
        const mc = memberById.get(s.serverId);
        const sync = syncById.get(s.serverId);
        return {
          serverId: s.serverId,
          serverName: s.serverName,
          memberCount: mc?.memberCount ?? 0,
          activeMembers: mc?.activeMembers ?? 0,
          roleCount: roleById.get(s.serverId) ?? 0,
          lastSync: sync?.finishedAt ? sync.finishedAt.toISOString() : null,
          syncStatus: sync?.status ?? 'never',
        };
      });

      return { servers: serverStats, totalServers, totalMembers };
    });
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
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
