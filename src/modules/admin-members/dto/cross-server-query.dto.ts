/**
 * Query parameters for the paginated cross-server member list.
 */
export interface CrossServerQueryDto {
  /** 'club' = only members in the main server, 'all' = any managed server */
  filter: 'club' | 'all';
  page: number;
  limit: number;
  /** Optional search on username / globalName */
  search?: string;
}

/**
 * A row in the cross-server list view (lighter than the full detail view).
 */
export interface CrossServerListItemDto {
  memberId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  isClubMember: boolean;
  serverCount: number;
  servers: {
    serverId: string;
    serverName: string;
    isMainServer: boolean;
    joinedAt: string | null;
    roleNames: string[];
  }[];
}

export interface PaginatedCrossServerListDto {
  data: CrossServerListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
