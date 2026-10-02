import type { PaginatedResponse } from '@/shared/types';
import type {
  CrossServerListItemDto,
  MemberCrossServerViewDto,
  MemberDetail,
  MemberDetailDto,
  MemberListItem,
  MemberServerDetail,
  PaginatedCrossServerListDto,
} from '@/features/members/types';

function toHexColor(color: number | null): string | null {
  if (color === null) return null;
  return `#${(color >>> 0).toString(16).padStart(6, '0')}`;
}

function getInitials(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function getAvatarInitials(globalName: string | null, username: string): string {
  return getInitials(globalName || username);
}

function getAvatarUrl(memberId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  const extension = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${memberId}/${avatar}.${extension}?size=64`;
}

function mapServerRoles(servers: MemberCrossServerViewDto['servers']): MemberServerDetail[] {
  return servers.map((server) => ({
    serverId: server.serverId,
    serverName: server.serverName,
    serverIcon: server.serverIcon,
    isMainServer: server.isMainServer,
    joinedAt: server.joinedAt,
    roles: server.roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: toHexColor(role.color),
      position: role.position,
    })),
  }));
}

export function mapMemberListItem(dto: CrossServerListItemDto): MemberListItem {
  const displayName = dto.globalName || dto.username;

  return {
    memberId: dto.memberId,
    username: dto.username,
    globalName: dto.globalName,
    displayName,
    avatar: dto.avatar,
    avatarUrl: getAvatarUrl(dto.memberId, dto.avatar),
    avatarInitials: getAvatarInitials(dto.globalName, dto.username),
    isClubMember: dto.isClubMember,
    serverCount: dto.serverCount,
    servers: dto.servers,
  };
}

export function mapMemberListResponse(
  dto: PaginatedCrossServerListDto
): PaginatedResponse<MemberListItem> {
  return {
    data: dto.data.map(mapMemberListItem),
    total: dto.total,
    page: dto.page,
    pageSize: dto.limit,
    totalPages: dto.totalPages,
  };
}

export function mapMemberDetail(dto: MemberDetailDto): MemberDetail {
  return {
    memberId: dto.memberId,
    username: dto.username,
    globalName: dto.globalName,
    displayName: dto.displayName,
    avatar: dto.avatar,
    avatarUrl: getAvatarUrl(dto.memberId, dto.avatar),
    avatarInitials: getAvatarInitials(dto.displayName || dto.globalName, dto.username),
    isClubMember: dto.isClubMember,
    servers: [],
  };
}

export function mapMemberServersResponse(dto: MemberCrossServerViewDto): MemberDetail {
  return {
    memberId: dto.memberId,
    username: dto.username,
    globalName: dto.globalName,
    displayName: dto.displayName,
    avatar: dto.avatar,
    avatarUrl: getAvatarUrl(dto.memberId, dto.avatar),
    avatarInitials: getAvatarInitials(dto.displayName || dto.globalName, dto.username),
    isClubMember: dto.isClubMember,
    servers: mapServerRoles(dto.servers),
  };
}
