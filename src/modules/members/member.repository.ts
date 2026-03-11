import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from './../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './../../database/entities';
import { eq, and, like, or, sql, inArray, lt, exists, SQL } from 'drizzle-orm';
import { members } from '../../database/entities/member.entity';
import { serverMembers } from '../../database/entities/server-member.entity';
import { serverMemberRoles } from '../../database/entities/server-member-role.entity';
import { roles } from '../../database/entities/role.entity';

interface DbPagination {
  offset: number;
  limit: number;
}

interface MemberProfile {
  discordId: string;
  username: string;
  globalName?: string;
  displayName?: string;
  avatar?: string;
  isClubMember: boolean;
  joinedAt?: Date;
  syncedAt: Date;
  roles: Array<{
    id: string;
    name: string;
    color?: number;
    position: number;
  }>;
}

@Injectable()
export class MemberRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findMemberByDiscordId(
    serverId: string,
    discordId: string,
  ): Promise<MemberProfile | null> {
    // Get member with server join info
    const [memberData] = await this.db
      .select({
        member: schema.members,
        joinedAt: schema.serverMembers.joinedAt,
      })
      .from(schema.members)
      .innerJoin(
        schema.serverMembers,
        and(
          eq(schema.members.id, schema.serverMembers.memberId),
          eq(schema.serverMembers.serverId, serverId),
        ),
      )
      .where(eq(schema.members.id, discordId))
      .limit(1);

    if (!memberData) {
      return null;
    }

    // Get roles
    const roles = await this.db
      .select({
        id: schema.roles.id,
        name: schema.roles.name,
        color: schema.roles.color,
        position: schema.roles.position,
      })
      .from(schema.roles)
      .innerJoin(
        schema.serverMemberRoles,
        eq(schema.roles.id, schema.serverMemberRoles.roleId),
      )
      .where(
        and(
          eq(schema.serverMemberRoles.memberId, discordId),
          eq(schema.roles.serverId, serverId),
        ),
      );

    const normalizedRoles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color ?? undefined,
      position: r.position ?? 0,
    }));

    return {
      discordId: memberData.member.id,
      username: memberData.member.username,
      globalName: memberData.member.globalName || undefined,
      displayName: memberData.member.displayName || undefined,
      avatar: memberData.member.avatar || undefined,
      isClubMember: memberData.member.isClubMember,
      joinedAt: memberData.joinedAt || undefined,
      syncedAt: memberData.member.syncedAt!,
      roles: normalizedRoles,
    };
  }

  async searchMembers(
    serverId: string,
    query?: string,
    roleId?: string,
    pagination?: DbPagination,
    isClubMember?: boolean,
    isActive?: boolean,
  ): Promise<{
    members: Array<{
      discordId: string;
      username: string;
      globalName?: string | null;
      displayName?: string | null;
      avatar?: string | null;
      isClubMember: boolean;
      joinedAt?: Date | null;
    }>;
    total: number;
  }> {
    // conditions array for dynamic filters
    const conditions: SQL[] = [];

    // search filter
    if (query?.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          like(schema.members.username, searchTerm),
          like(schema.members.globalName, searchTerm),
          like(schema.members.displayName, searchTerm),
        )!,
      );
    }

    // role filter
    if (roleId) {
      conditions.push(
        exists(
          this.db
            .select({ id: sql<number>`1` })
            .from(schema.serverMemberRoles)
            .where(
              and(
                eq(schema.serverMemberRoles.roleId, roleId),
                eq(schema.serverMemberRoles.memberId, schema.members.id),
              ),
            ),
        ),
      );
    }

    // isClubMember filter
    if (isClubMember !== undefined) {
      conditions.push(eq(schema.members.isClubMember, isClubMember));
    }

    // isActive filter (on server membership)
    if (isActive !== undefined) {
      conditions.push(eq(schema.serverMembers.isActive, isActive));
    }

    // base query
    let baseQuery = this.db
      .select({
        discordId: schema.members.id,
        username: schema.members.username,
        globalName: schema.members.globalName,
        displayName: schema.members.displayName,
        avatar: schema.members.avatar,
        isClubMember: schema.members.isClubMember,
        joinedAt: schema.serverMembers.joinedAt,
      })
      .from(schema.members)
      .innerJoin(
        schema.serverMembers,
        and(
          eq(schema.members.id, schema.serverMembers.memberId),
          eq(schema.serverMembers.serverId, serverId),
        ),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .$dynamic();

    // total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(baseQuery.as('base'))
      .execute();

    const total = parseInt(countResult[0]?.count?.toString() || '0');

    // pagination
    if (pagination) {
      baseQuery = baseQuery
        .limit(pagination.limit)
        .offset(pagination.offset)
        .orderBy(schema.serverMembers.joinedAt);
    }

    const members = await baseQuery.execute();

    return {
      members,
      total,
    };
  }

  // SYNC METHODS

  async upsertMember(
    data: typeof members.$inferInsert,
  ): Promise<typeof members.$inferSelect> {
    const [row] = await this.db
      .insert(members)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: members.id,
        set: {
          username: data.username,
          globalName: data.globalName,
          displayName: data.displayName,
          avatar: data.avatar,
          email: data.email,
          isClubMember: data.isClubMember,
          syncedAt: data.syncedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async upsertServerMembership(
    data: typeof serverMembers.$inferInsert,
  ): Promise<typeof serverMembers.$inferSelect> {
    const [row] = await this.db
      .insert(serverMembers)
      .values(data)
      .onConflictDoUpdate({
        target: [serverMembers.serverId, serverMembers.memberId],
        set: {
          joinedAt: data.joinedAt,
          isActive: data.isActive,
          lastSyncedAt: data.lastSyncedAt,
        },
      })
      .returning();
    return row;
  }

  async replaceMemberRoles(
    serverId: string,
    memberId: string,
    roleIds: string[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existingRoles = await tx
        .select({ roleId: serverMemberRoles.roleId })
        .from(serverMemberRoles)
        .innerJoin(roles, eq(serverMemberRoles.roleId, roles.id))
        .where(
          and(
            eq(serverMemberRoles.memberId, memberId),
            eq(roles.serverId, serverId),
          ),
        );

      if (existingRoles.length > 0) {
        const roleIdsToDelete = existingRoles.map((r) => r.roleId);
        await tx
          .delete(serverMemberRoles)
          .where(
            and(
              eq(serverMemberRoles.memberId, memberId),
              inArray(serverMemberRoles.roleId, roleIdsToDelete),
            ),
          );
      }

      if (roleIds.length > 0) {
        await tx.insert(serverMemberRoles).values(
          roleIds.map((roleId) => ({
            memberId,
            roleId,
          })),
        );
      }
    });
  }

  async markInactiveForServer(
    serverId: string,
    syncStart: Date,
  ): Promise<number> {
    const result = await this.db
      .update(serverMembers)
      .set({ isActive: false, lastSyncedAt: new Date() })
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.isActive, true),
          lt(serverMembers.lastSyncedAt, syncStart),
        ),
      );
    return result.rowCount ?? 0;
  }

  // role deletion
  async deleteMemberRolesByRoleId(roleId: string): Promise<void> {
    await this.db
      .delete(serverMemberRoles)
      .where(eq(serverMemberRoles.roleId, roleId));
  }
}
