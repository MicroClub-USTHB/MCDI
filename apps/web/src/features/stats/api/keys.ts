import type { GrowthGranularity, MemberStatsFilters, StatsDateRange } from '@/features/stats/types';

export const statsKeys = {
  all: ['stats'] as const,
  members: (filters: MemberStatsFilters) => [...statsKeys.all, 'members', filters] as const,
  growth: (period: StatsDateRange, granularity: GrowthGranularity) =>
    [...statsKeys.all, 'growth', period, granularity] as const,
  roles: (serverId?: string) => [...statsKeys.all, 'roles', serverId ?? 'global'] as const,
  servers: () => [...statsKeys.all, 'servers'] as const,
};
