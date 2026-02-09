/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/entities';
import { eq, and, like, or, sql } from 'drizzle-orm';

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
  ): Promise<{
    members: Array<{
      id: string;
      username: string;
      globalName?: string;
      displayName?: string;
      avatar?: string;
      isClubMember: boolean;
      joinedAt?: Date;
    }>;
    total: number;
  }> {
    // base query
    let baseQuery: any = this.db
      .select({
        id: schema.members.id,
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
      );

    // search filter
    if (query?.trim()) {
      const searchTerm = `%${query.trim()}%`;
      baseQuery = baseQuery.where(
        or(
          like(schema.members.username, searchTerm),
          like(schema.members.globalName, searchTerm),
          like(schema.members.displayName, searchTerm),
        ),
      );
    }

    // role filter
    if (roleId) {
      baseQuery = baseQuery
        .innerJoin(
          schema.serverMemberRoles,
          eq(schema.members.id, schema.serverMemberRoles.memberId),
        )
        .where(
          and(
            eq(schema.serverMemberRoles.roleId, roleId),
            eq(schema.serverMemberRoles.memberId, schema.members.id),
          ),
        );
    }

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
}
