'use client';

import { useQuery } from '@tanstack/react-query';
import { statsKeys } from '@/features/stats/api/keys';
import {
  fetchMemberGrowth,
  fetchMemberStats,
  fetchRoleStats,
  fetchServerStats,
} from '@/features/stats/api/service';
import {
  mapGrowthResponse,
  mapMemberStatsResponse,
  mapRoleStatsResponse,
  mapServerStatsResponse,
} from '@/features/stats/api/mappers';
import type { GrowthGranularity, MemberStatsFilters, StatsDateRange } from '@/features/stats/types';
import { useCan } from '@/shared/lib/use-access';

/** Matches the backend's own 5-minute Redis cache — no point refetching sooner. */
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

const DEFAULT_MEMBER_STATS_FILTERS: MemberStatsFilters = { dateRange: '30d' };

export function useMemberStatsQuery(filters: MemberStatsFilters = DEFAULT_MEMBER_STATS_FILTERS) {
  const allowed = useCan('stats', 'read');
  return useQuery({
    queryKey: statsKeys.members(filters),
    queryFn: async () => {
      const response = await fetchMemberStats(filters);
      return mapMemberStatsResponse(response.data);
    },
    staleTime: STATS_STALE_TIME_MS,
    retry: false,
    enabled: allowed,
  });
}

export function useMemberGrowthQuery(period: StatsDateRange, granularity: GrowthGranularity) {
  const allowed = useCan('stats', 'read');
  return useQuery({
    queryKey: statsKeys.growth(period, granularity),
    queryFn: async () => {
      const response = await fetchMemberGrowth(period, granularity);
      return mapGrowthResponse(response.data);
    },
    staleTime: STATS_STALE_TIME_MS,
    retry: false,
    enabled: allowed,
  });
}

export function useRoleStatsQuery(serverId?: string) {
  const allowed = useCan('stats', 'read');
  return useQuery({
    queryKey: statsKeys.roles(serverId),
    queryFn: async () => {
      const response = await fetchRoleStats(serverId);
      return mapRoleStatsResponse(response.data);
    },
    staleTime: STATS_STALE_TIME_MS,
    retry: false,
    enabled: allowed,
  });
}

export function useServerStatsQuery() {
  const allowed = useCan('stats', 'read');
  return useQuery({
    queryKey: statsKeys.servers(),
    queryFn: async () => {
      const response = await fetchServerStats();
      return mapServerStatsResponse(response.data);
    },
    staleTime: STATS_STALE_TIME_MS,
    retry: false,
    enabled: allowed,
  });
}
