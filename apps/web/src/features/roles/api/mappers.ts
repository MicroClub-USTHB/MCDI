import type {
  InheritanceRule,
  RolePermissionsResponse,
  RoleStatsItem,
  RoleStatsResponse,
} from '@/features/roles/types';

export interface RoleStatsView {
  roleId: string;
  roleName: string;
  /** `roleName` cleaned up — Discord spacer roles (blank / punctuation-only) become "Unnamed role". */
  displayName: string;
  memberCount: number;
  percentageLabel: string;
  hierarchyLevel: number | null;
  colorHex: string | null;
  /** True when the backend flags the role as global/protected (may be absent). */
  isGlobal?: boolean;
}

/** Discord servers use invisible-char / punctuation roles as visual separators. */
function roleDisplayName(roleName: string): string {
  const trimmed = roleName.trim();
  if (!trimmed) return 'Unnamed role';
  // Only whitespace-like unicode or pure separator punctuation → treat as unnamed.
  if (/^[\s⠀ ㅤᅟ—―_*~=\-–—·•▬▭▮▯|]+$/.test(trimmed)) {
    return 'Unnamed role';
  }
  return trimmed;
}

export interface RolePermissionsView {
  roleId: string;
  roleName: string;
  serverId: string;
  permissionIds: Set<number>;
}

export interface InheritanceRuleView {
  id: number;
  sourceRoleId: string;
  targetScope: 'all' | 'selected';
  enabled: boolean;
  updatedAtLabel: string;
  targetServerIds: string[];
}

function formatDiscordColor(color: number | null): string | null {
  if (!color) return null;
  return `#${color.toString(16).padStart(6, '0')}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function mapRoleStatsItem(dto: RoleStatsItem): RoleStatsView {
  return {
    roleId: dto.roleId,
    roleName: dto.roleName,
    displayName: roleDisplayName(dto.roleName),
    memberCount: dto.memberCount,
    percentageLabel: `${dto.percentage.toFixed(1)}%`,
    hierarchyLevel: dto.hierarchyLevel,
    colorHex: formatDiscordColor(dto.color),
    ...(dto.isGlobal !== undefined ? { isGlobal: dto.isGlobal } : {}),
  };
}

/**
 * Returns the protected/executive role id. Prefers the backend's explicit
 * `isGlobal` flag when present; otherwise falls back to the highest-ranking
 * role (lowest hierarchyLevel). Shared so RoleTable, HierarchyTree and the
 * detail view agree on the same result.
 */
export function getExecutiveRoleId(roles: RoleStatsView[]): string | null {
  const global = roles.find((r) => r.isGlobal === true);
  if (global) return global.roleId;

  return (
    roles
      .filter((r) => r.hierarchyLevel !== null)
      .sort((a, b) => (a.hierarchyLevel ?? 0) - (b.hierarchyLevel ?? 0))[0]?.roleId ?? null
  );
}

export function mapRoleStatsResponse(dto: RoleStatsResponse): {
  serverName: string;
  totalMembers: number;
  roles: RoleStatsView[];
} {
  return {
    serverName: dto.serverName,
    totalMembers: dto.totalMembers,
    roles: dto.roles.map(mapRoleStatsItem),
  };
}

export function mapRolePermissionsResponse(dto: RolePermissionsResponse): RolePermissionsView {
  return {
    roleId: dto.roleId,
    roleName: dto.roleName,
    serverId: dto.serverId,
    permissionIds: new Set(dto.permissions.map((p) => p.id)),
  };
}

export function mapInheritanceRule(dto: InheritanceRule): InheritanceRuleView {
  return {
    id: dto.id,
    sourceRoleId: dto.sourceRoleId,
    targetScope: dto.targetScope,
    enabled: dto.enabled,
    updatedAtLabel: formatDate(dto.updatedAt),
    targetServerIds: dto.targetServerIds,
  };
}
