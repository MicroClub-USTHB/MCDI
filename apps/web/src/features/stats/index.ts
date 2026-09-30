export const stats = {
  name: 'Stats',
  route: '/dashboard/stats',
} as const;

export { statsKeys } from './api/keys';
export {
  fetchMemberGrowth,
  fetchMemberStats,
  fetchRoleStats,
  fetchServerStats,
} from './api/service';
export {
  mapGrowthResponse,
  mapMemberStatsResponse,
  mapRoleStatsResponse,
  mapServerStatsResponse,
} from './api/mappers';
export {
  useMemberGrowthQuery,
  useMemberStatsQuery,
  useRoleStatsQuery,
  useServerStatsQuery,
} from './api/queries';
export type {
  GlobalRoleStatDto,
  GlobalRoleStatsResponseDto,
  GrowthGranularity,
  GrowthPoint,
  GrowthPointDto,
  GrowthResponseDto,
  GrowthStats,
  MemberRoleSummaryDto,
  MemberStats,
  MemberStatsDto,
  MemberStatsFilters,
  RoleStat,
  RoleStats,
  RoleStatsResponseDto,
  ServerMemberSummaryDto,
  ServerStat,
  ServerStatDto,
  ServerStats,
  ServerStatsDto,
  ServerRoleStatDto,
  ServerRoleStatsResponseDto,
  StatsDateRange,
} from './types';
