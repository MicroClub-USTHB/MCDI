import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  GrowthGranularity,
  GrowthResponseDto,
  MemberStatsDto,
  MemberStatsFilters,
  RoleStatsResponseDto,
  ServerStatsDto,
  StatsDateRange,
} from '@/features/stats/types';

function createQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function fetchMemberStats(
  filters: MemberStatsFilters = { dateRange: '30d' }
): Promise<ApiResponse<MemberStatsDto>> {
  const queryString = createQueryString({
    serverId: filters.serverId,
    dateRange: filters.dateRange,
  });

  return apiClient.get<MemberStatsDto>(`/admin/stats/members${queryString}`);
}

export function fetchMemberGrowth(
  period: StatsDateRange,
  granularity: GrowthGranularity
): Promise<ApiResponse<GrowthResponseDto>> {
  const queryString = createQueryString({ period, granularity });
  return apiClient.get<GrowthResponseDto>(`/admin/stats/members/growth${queryString}`);
}

export function fetchRoleStats(serverId?: string): Promise<ApiResponse<RoleStatsResponseDto>> {
  const queryString = createQueryString({ serverId });
  return apiClient.get<RoleStatsResponseDto>(`/admin/stats/roles${queryString}`);
}

export function fetchServerStats(): Promise<ApiResponse<ServerStatsDto>> {
  return apiClient.get<ServerStatsDto>('/admin/stats/servers');
}
