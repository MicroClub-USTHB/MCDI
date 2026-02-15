import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminMembersRepository } from './admin-members.repository';
import {
  CrossServerListItemDto,
  CrossServerQueryDto,
  MemberCrossServerViewDto,
  MemberServerDetailDto,
  PaginatedCrossServerListDto,
  RoleDto,
} from './dto';

@Injectable()
export class AdminMembersService {
  constructor(
    private readonly adminMembersRepository: AdminMembersRepository,
  ) {}

  // ───────────────────────── Per-member detail ─────────────────────────

  /**
   * GET /admin/members/:discordId/servers
   *
   * Returns full cross-server view for a single member:
   * every managed server they belong to, their roles, join date,
   * and whether they qualify as a "club member".
   */
  async getMemberCrossServerView(
    discordId: string,
  ): Promise<MemberCrossServerViewDto> {
    // 1. Fetch member
    const member =
      await this.adminMembersRepository.findMemberById(discordId);

    if (!member) {
      throw new NotFoundException(`Member ${discordId} not found`);
    }

    // 2. Fetch all server memberships joined with server info
    const memberships =
      await this.adminMembersRepository.findMembershipsByMemberId(discordId);

    // 3. Fetch all roles for this member across servers
    const memberRoles =
      await this.adminMembersRepository.findRolesByMemberId(discordId);

    // 4. Group roles by server
    const rolesByServer = new Map<string, RoleDto[]>();
    for (const r of memberRoles) {
      const list = rolesByServer.get(r.serverId) ?? [];
      list.push({
        id: r.roleId,
        name: r.roleName,
        color: r.roleColor,
        position: r.rolePosition,
      });
      rolesByServer.set(r.serverId, list);
    }

    // 5. Build response
    const isClubMember = memberships.some((m) => m.isMainServer);

    const servers: MemberServerDetailDto[] = memberships.map((m) => ({
      serverId: m.serverId,
      serverName: m.serverName,
      serverIcon: m.serverIcon,
      isMainServer: m.isMainServer,
      joinedAt: m.joinedAt?.toISOString() ?? null,
      roles: (rolesByServer.get(m.serverId) ?? []).sort(
        (a, b) => (b.position ?? 0) - (a.position ?? 0),
      ),
    }));

    return {
      memberId: member.id,
      username: member.username,
      globalName: member.globalName,
      displayName: member.displayName,
      avatar: member.avatar,
      isClubMember,
      servers,
    };
  }

  // ──────────────────────── Cross-server list ──────────────────────────

  /**
   * GET /admin/members/cross-server?filter=club|all&page=&limit=&search=
   *
   * Paginated list of members across all managed servers.
   * filter=club  → only members present in the main server
   * filter=all   → any member in any managed server
   */
  async getCrossServerList(
    query: CrossServerQueryDto,
  ): Promise<PaginatedCrossServerListDto> {
    const { filter, page, limit, search } = query;
    const offset = (page - 1) * limit;

    // Count total matching members
    const totalCount = await this.adminMembersRepository.countMembers(
      filter,
      search,
    );

    // Fetch the page of members
    const memberRows = await this.adminMembersRepository.findMembersPaginated(
      filter,
      search,
      limit,
      offset,
    );

    if (memberRows.length === 0) {
      return {
        data: [],
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    }

    const memberIds = memberRows.map((m) => m.id);

    // Fetch server memberships for these members
    const memberships =
      await this.adminMembersRepository.findMembershipsByMemberIds(memberIds);

    // Fetch roles for these members
    const memberRoles =
      await this.adminMembersRepository.findRoleNamesByMemberIds(memberIds);

    // Index memberships & roles by memberId
    const membershipMap = new Map<string, typeof memberships>();
    for (const m of memberships) {
      const list = membershipMap.get(m.memberId) ?? [];
      list.push(m);
      membershipMap.set(m.memberId, list);
    }

    const roleMap = new Map<string, Map<string, string[]>>();
    for (const r of memberRoles) {
      if (!roleMap.has(r.memberId)) roleMap.set(r.memberId, new Map());
      const srvMap = roleMap.get(r.memberId)!;
      const list = srvMap.get(r.serverId) ?? [];
      list.push(r.roleName);
      srvMap.set(r.serverId, list);
    }

    // Build response items
    const data: CrossServerListItemDto[] = memberRows.map((m) => {
      const srvs = membershipMap.get(m.id) ?? [];
      const isClubMember = srvs.some((s) => s.isMainServer);

      return {
        memberId: m.id,
        username: m.username,
        globalName: m.globalName,
        avatar: m.avatar,
        isClubMember,
        serverCount: srvs.length,
        servers: srvs.map((s) => ({
          serverId: s.serverId,
          serverName: s.serverName,
          isMainServer: s.isMainServer,
          joinedAt: s.joinedAt?.toISOString() ?? null,
          roleNames: roleMap.get(m.id)?.get(s.serverId) ?? [],
        })),
      };
    });

    return {
      data,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  // ─────────────────────────── Export ───────────────────────────────

  /**
   * Build export data (all matching members, no pagination).
   * Returns an array of flat objects suitable for CSV/JSON.
   */
  async getExportData(
    filter: 'club' | 'all',
  ): Promise<Record<string, unknown>[]> {
    // Re-use the list query with a very high limit
    const result = await this.getCrossServerList({
      filter,
      page: 1,
      limit: 100_000,
    });

    // Flatten for CSV
    const rows: Record<string, unknown>[] = [];
    for (const item of result.data) {
      for (const srv of item.servers) {
        rows.push({
          discord_id: item.memberId,
          username: item.username,
          global_name: item.globalName ?? '',
          is_club_member: item.isClubMember,
          server_id: srv.serverId,
          server_name: srv.serverName,
          is_main_server: srv.isMainServer,
          joined_at: srv.joinedAt ?? '',
          roles: srv.roleNames.join('; '),
        });
      }
    }
    return rows;
  }
}
