import type {
  GlobalRoleStatDto,
  GrowthResponseDto,
  GrowthStats,
  MemberStats,
  MemberStatsDto,
  RoleStat,
  RoleStats,
  RoleStatsResponseDto,
  ServerStats,
  ServerStatsDto,
  ServerRoleStatDto,
} from '@/features/stats/types';

function toHexColor(color: number | null): string | null {
  if (color === null) return null;
  return `#${(color >>> 0).toString(16).padStart(6, '0')}`;
}

function normalizeRoleName(roleName: string): string {
  return roleName.trim() || 'Unnamed role';
}

export function mapMemberStatsResponse(dto: MemberStatsDto): MemberStats {
  return {
    totalMembers: dto.totalMembers,
    clubMembers: dto.clubMembers,
    nonClubMembers: dto.nonClubMembers,
    activeMembers: dto.activeMembers,
    inactiveMembers: dto.inactiveMembers,
    newMembersThisPeriod: dto.newMembersThisPeriod,
    growthRate: dto.growthRate,
    byRole: dto.byRole.map((role) => ({
      roleName: normalizeRoleName(role.roleName),
      count: role.count,
      percentage: role.percentage,
    })),
    byServer: dto.byServer.map((server) => ({
      serverId: server.serverId,
      serverName: server.serverName,
      memberCount: server.memberCount,
    })),
  };
}

export function mapServerStatsResponse(dto: ServerStatsDto): ServerStats {
  return {
    totalServers: dto.totalServers,
    totalMembers: dto.totalMembers,
    servers: dto.servers.map((server) => ({
      serverId: server.serverId,
      serverName: server.serverName,
      memberCount: server.memberCount,
      activeMembers: server.activeMembers,
      roleCount: server.roleCount,
      lastSync: server.lastSync,
      syncStatus: server.syncStatus,
    })),
  };
}

export function mapGrowthResponse(dto: GrowthResponseDto): GrowthStats {
  return {
    data: dto.data.map((point) => ({
      ...point,
      netMembers: point.newMembers - point.leftMembers,
    })),
    period: dto.period,
    totalGrowth: dto.totalGrowth,
  };
}

function isServerRoleStat(role: ServerRoleStatDto | GlobalRoleStatDto): role is ServerRoleStatDto {
  return 'roleId' in role;
}

export function mapRoleStatsResponse(dto: RoleStatsResponseDto): RoleStats {
  return {
    serverId: dto.serverId,
    serverName: dto.serverName,
    scope: dto.scope,
    totalMembers: dto.totalMembers,
    roles: dto.roles.map((role): RoleStat => {
      const serverRole = isServerRoleStat(role) ? role : null;

      return {
        roleId: serverRole?.roleId ?? null,
        roleName: normalizeRoleName(role.roleName),
        memberCount: role.memberCount,
        percentage: (role.memberCount / Math.max(1, dto.totalMembers)) * 100,
        hierarchyLevel: serverRole?.hierarchyLevel ?? null,
        color: toHexColor(serverRole?.color ?? null),
      };
    }),
  };
}
