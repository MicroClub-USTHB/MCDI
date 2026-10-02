export interface CrossServerListItemDto {
  memberId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  isClubMember: boolean;
  serverCount: number;
  servers: Array<{
    serverId: string;
    serverName: string;
    isMainServer: boolean;
    joinedAt: string | null;
    roleNames: string[];
  }>;
}

export interface PaginatedCrossServerListDto {
  data: CrossServerListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MemberDetailDto {
  memberId: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  isClubMember: boolean;
}

export interface MemberCrossServerViewDto {
  memberId: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  isClubMember: boolean;
  servers: Array<{
    serverId: string;
    serverName: string;
    serverIcon: string | null;
    isMainServer: boolean;
    joinedAt: string | null;
    roles: Array<{
      id: string;
      name: string;
      color: number | null;
      position: number | null;
    }>;
  }>;
}

export interface ServerRoleOptionDto {
  roleId: string;
  roleName: string;
  memberCount: number;
  hierarchyLevel: number;
  color: number | null;
}

export interface ServerRolesResponseDto {
  serverId: string;
  serverName: string;
  scope: string;
  roles: ServerRoleOptionDto[];
  totalMembers: number;
}

export interface MemberListServerSummary {
  serverId: string;
  serverName: string;
  isMainServer: boolean;
  joinedAt: string | null;
  roleNames: string[];
}

export interface MemberRole {
  id: string;
  name: string;
  color: string | null;
  position: number | null;
}

export interface MemberServerDetail {
  serverId: string;
  serverName: string;
  serverIcon: string | null;
  isMainServer: boolean;
  joinedAt: string | null;
  roles: MemberRole[];
}

export interface MemberListItem {
  memberId: string;
  username: string;
  globalName: string | null;
  displayName: string;
  avatar: string | null;
  avatarUrl: string | null;
  avatarInitials: string;
  isClubMember: boolean;
  serverCount: number;
  servers: MemberListServerSummary[];
}

export interface MemberDetail {
  memberId: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  avatarInitials: string;
  isClubMember: boolean;
  servers: MemberServerDetail[];
}

export interface MemberFilters {
  filter: 'club' | 'all';
  serverIds: string[];
  roleIds: string[];
  search?: string;
  page: number;
  pageSize: number;
}

export interface MemberPermissionsDto {
  discordId: string;
  serverId: string;
  permissions: string[];
  sources?: {
    global: string[];
    server: string[];
    inherited: string[];
  };
}
