export type StatsDateRange = '7d' | '30d' | '90d' | '1y';
export type GrowthGranularity = 'daily' | 'weekly' | 'monthly';

export interface MemberStatsFilters {
  serverId?: string;
  dateRange: StatsDateRange;
}

/** Raw shape returned by `GET /api/admin/stats/members`. */
export interface MemberStatsDto {
  totalMembers: number;
  clubMembers: number;
  nonClubMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisPeriod: number;
  growthRate: number;
  byRole: MemberRoleSummaryDto[];
  byServer: ServerMemberSummaryDto[];
}

export interface MemberRoleSummaryDto {
  roleName: string;
  count: number;
  percentage: number;
}

export interface ServerMemberSummaryDto {
  serverId: string;
  serverName: string;
  memberCount: number;
}

/** Raw shape returned by `GET /api/admin/stats/servers`. */
export interface ServerStatDto {
  serverId: string;
  serverName: string;
  memberCount: number;
  activeMembers: number;
  roleCount: number;
  lastSync: string | null;
  syncStatus: string;
}

export interface ServerStatsDto {
  servers: ServerStatDto[];
  totalServers: number;
  totalMembers: number;
}

export interface MemberStats {
  totalMembers: number;
  clubMembers: number;
  nonClubMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisPeriod: number;
  growthRate: number;
  byRole: MemberRoleSummaryDto[];
  byServer: ServerMemberSummaryDto[];
}

export type ServerStat = ServerStatDto;

export interface ServerStats {
  servers: ServerStat[];
  totalServers: number;
  totalMembers: number;
}

export interface GrowthPointDto {
  date: string;
  count: number;
  newMembers: number;
  leftMembers: number;
}

export interface GrowthResponseDto {
  data: GrowthPointDto[];
  period: StatsDateRange;
  totalGrowth: number;
}

export interface GrowthPoint extends GrowthPointDto {
  netMembers: number;
}

export interface GrowthStats {
  data: GrowthPoint[];
  period: StatsDateRange;
  totalGrowth: number;
}

export interface ServerRoleStatDto {
  roleId: string;
  roleName: string;
  memberCount: number;
  hierarchyLevel: number;
  color: number | null;
}

export interface GlobalRoleStatDto {
  roleName: string;
  memberCount: number;
}

export interface ServerRoleStatsResponseDto {
  serverId: string;
  serverName: string;
  scope: 'server';
  roles: ServerRoleStatDto[];
  totalMembers: number;
}

export interface GlobalRoleStatsResponseDto {
  serverId: null;
  serverName: null;
  scope: 'global';
  roles: GlobalRoleStatDto[];
  totalMembers: number;
}

export type RoleStatsResponseDto = ServerRoleStatsResponseDto | GlobalRoleStatsResponseDto;

export interface RoleStat {
  roleId: string | null;
  roleName: string;
  memberCount: number;
  percentage: number;
  hierarchyLevel: number | null;
  color: string | null;
}

export interface RoleStats {
  serverId: string | null;
  serverName: string | null;
  scope: 'global' | 'server';
  roles: RoleStat[];
  totalMembers: number;
}
