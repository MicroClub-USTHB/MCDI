import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
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
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
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
    const member = await this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, discordId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw new NotFoundException(`Member ${discordId} not found`);
    }

    // 2. Fetch all server memberships joined with server info
    const memberships = await this.db
      .select({
        serverId: schema.serverMembers.serverId,
        joinedAt: schema.serverMembers.joinedAt,
        serverName: schema.servers.name,
        serverIcon: schema.servers.icon,
        isMainServer: schema.servers.isMain,
      })
      .from(schema.serverMembers)
      .innerJoin(
        schema.servers,
        eq(schema.serverMembers.serverId, schema.servers.id),
      )
      .where(eq(schema.serverMembers.memberId, discordId));

    // 3. Fetch all roles for this member across servers
    const memberRoles = await this.db
      .select({
        roleId: schema.serverMemberRoles.roleId,
        roleName: schema.roles.name,
        roleColor: schema.roles.color,
        rolePosition: schema.roles.position,
        serverId: schema.roles.serverId,
      })
      .from(schema.serverMemberRoles)
      .innerJoin(
        schema.roles,
        eq(schema.serverMemberRoles.roleId, schema.roles.id),
      )
      .where(eq(schema.serverMemberRoles.memberId, discordId));

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

    // --- Build the member query depending on the filter ---

    // Base: members who have at least one server_member row
    const baseConditions = [];

    if (search) {
      baseConditions.push(
        or(
          ilike(schema.members.username, `%${search}%`),
          ilike(schema.members.globalName, `%${search}%`),
        ),
      );
    }

    if (filter === 'club') {
      // Members who are in the main server
      const mainServerSubquery = this.db
        .select({ memberId: schema.serverMembers.memberId })
        .from(schema.serverMembers)
        .innerJoin(
          schema.servers,
          eq(schema.serverMembers.serverId, schema.servers.id),
        )
        .where(eq(schema.servers.isMain, true));

      baseConditions.push(
        inArray(schema.members.id, mainServerSubquery),
      );
    }

    // Count total matching members (who exist in server_members)
    const allMemberIdsInServers = this.db
      .selectDistinct({ memberId: schema.serverMembers.memberId })
      .from(schema.serverMembers);

    const countConditions = [
      inArray(schema.members.id, allMemberIdsInServers),
      ...baseConditions,
    ];

    const [{ count: totalCount }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.members)
      .where(and(...countConditions));

    // Fetch the page of members
    const memberRows = await this.db
      .select({
        id: schema.members.id,
        username: schema.members.username,
        globalName: schema.members.globalName,
        avatar: schema.members.avatar,
      })
      .from(schema.members)
      .where(and(...countConditions))
      .orderBy(schema.members.username)
      .limit(limit)
      .offset(offset);

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
    const memberships = await this.db
      .select({
        memberId: schema.serverMembers.memberId,
        serverId: schema.serverMembers.serverId,
        joinedAt: schema.serverMembers.joinedAt,
        serverName: schema.servers.name,
        isMainServer: schema.servers.isMain,
      })
      .from(schema.serverMembers)
      .innerJoin(
        schema.servers,
        eq(schema.serverMembers.serverId, schema.servers.id),
      )
      .where(inArray(schema.serverMembers.memberId, memberIds));

    // Fetch roles for these members
    const memberRoles = await this.db
      .select({
        memberId: schema.serverMemberRoles.memberId,
        serverId: schema.roles.serverId,
        roleName: schema.roles.name,
      })
      .from(schema.serverMemberRoles)
      .innerJoin(
        schema.roles,
        eq(schema.serverMemberRoles.roleId, schema.roles.id),
      )
      .where(inArray(schema.serverMemberRoles.memberId, memberIds));

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
          roleNames:
            roleMap.get(m.id)?.get(s.serverId) ?? [],
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
