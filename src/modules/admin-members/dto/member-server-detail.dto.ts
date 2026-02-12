/**
 * Represents a single server a member belongs to,
 * including their roles and join date within that server.
 */
export interface RoleDto {
  id: string;
  name: string;
  color: number | null;
  position: number | null;
}

export interface MemberServerDetailDto {
  serverId: string;
  serverName: string;
  serverIcon: string | null;
  isMainServer: boolean;
  joinedAt: string | null; // ISO date
  roles: RoleDto[];
}

/**
 * Full cross-server view for a single Discord member.
 */
export interface MemberCrossServerViewDto {
  memberId: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  isClubMember: boolean;
  servers: MemberServerDetailDto[];
}
