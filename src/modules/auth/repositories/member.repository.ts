import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, like, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateMemberDto {
  id: string;
  username: string;
  globalName?: string;
  displayName?: string;
  avatar?: string;
  email?: string;
  isClubMember?: boolean;
  joinedAt?: Date;
}

export interface UpdateMemberDto {
  username?: string;
  globalName?: string;
  displayName?: string;
  avatar?: string;
  email?: string;
  isClubMember?: boolean;
  joinedAt?: Date;
  syncedAt?: Date;
}

@Injectable()
export class MemberRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async findById(id: string) {
    const members = await this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);

    return members[0] || null;
  }

  async findByEmail(email: string) {
    const members = await this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.email, email))
      .limit(1);

    return members[0] || null;
  }

  async findByUsername(username: string) {
    const members = await this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.username, username))
      .limit(1);

    return members[0] || null;
  }

  async setPasswordHash(memberId: string, passwordHash: string) {
    await this.db
      .update(schema.members)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.members.id, memberId));
  }

  async findClubMembers(limit: number = 100, offset: number = 0) {
    return this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.isClubMember, true))
      .limit(limit)
      .offset(offset);
  }

  async findAll(limit: number = 100, offset: number = 0) {
    return this.db.select().from(schema.members).limit(limit).offset(offset);
  }

  async search(query: string, limit: number = 50) {
    return this.db
      .select()
      .from(schema.members)
      .where(
        or(
          like(schema.members.username, `%${query}%`),
          like(schema.members.globalName, `%${query}%`),
          like(schema.members.displayName, `%${query}%`),
          like(schema.members.email, `%${query}%`),
        ),
      )
      .limit(limit);
  }

  async create(data: CreateMemberDto) {
    const members = await this.db
      .insert(schema.members)
      .values({
        id: data.id,
        username: data.username,
        globalName: data.globalName,
        displayName: data.displayName,
        avatar: data.avatar,
        email: data.email,
        isClubMember: data.isClubMember ?? false,
        joinedAt: data.joinedAt,
      })
      .returning();

    return members[0];
  }

  async update(id: string, data: UpdateMemberDto) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.username !== undefined) updateData.username = data.username;
    if (data.globalName !== undefined) updateData.globalName = data.globalName;
    if (data.displayName !== undefined)
      updateData.displayName = data.displayName;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.isClubMember !== undefined)
      updateData.isClubMember = data.isClubMember;
    if (data.joinedAt !== undefined) updateData.joinedAt = data.joinedAt;
    if (data.syncedAt !== undefined) updateData.syncedAt = data.syncedAt;

    const members = await this.db
      .update(schema.members)
      .set(updateData)
      .where(eq(schema.members.id, id))
      .returning();

    return members[0] || null;
  }

  async upsert(data: CreateMemberDto & UpdateMemberDto) {
    const existing = await this.findById(data.id);

    if (existing) {
      return this.update(data.id, data);
    }

    return this.create(data);
  }

  async delete(id: string) {
    await this.db.delete(schema.members).where(eq(schema.members.id, id));
  }

  async setClubMemberStatus(id: string, isClubMember: boolean) {
    const members = await this.db
      .update(schema.members)
      .set({
        isClubMember,
        updatedAt: new Date(),
      })
      .where(eq(schema.members.id, id))
      .returning();

    return members[0] || null;
  }

  async updateSyncedAt(id: string) {
    const members = await this.db
      .update(schema.members)
      .set({
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.members.id, id))
      .returning();

    return members[0] || null;
  }

  /** Get a member's role IDs and names in a specific server */
  async getMemberRolesInServer(memberId: string, serverId: string) {
    return this.db
      .select({
        roleId: schema.serverMemberRoles.roleId,
        roleName: schema.roles.name,
        roleColor: schema.roles.color,
        rolePosition: schema.roles.position,
      })
      .from(schema.serverMemberRoles)
      .innerJoin(schema.roles, eq(schema.serverMemberRoles.roleId, schema.roles.id))
      .where(
        and(
          eq(schema.serverMemberRoles.memberId, memberId),
          eq(schema.roles.serverId, serverId),
        ),
      );
  }

  /**
   * Sync a member's server membership and Discord roles into the MCDI DB.
   * Called during OAuth callback so roles are always up-to-date.
   */
  async syncMemberServerData(
    memberId: string,
    serverId: string,
    discordRoles: {
      id: string;
      name: string;
      color?: number;
      position?: number;
    }[],
  ): Promise<void> {
    // 1. Ensure server_members row exists
    await this.db
      .insert(schema.serverMembers)
      .values({ memberId, serverId, joinedAt: new Date() })
      .onConflictDoNothing();

    if (discordRoles.length === 0) return;

    // 2. Upsert roles into the roles table (Discord role ID is PK)
    await this.db
      .insert(schema.roles)
      .values(
        discordRoles.map((r) => ({
          id: r.id,
          serverId,
          name: r.name,
          color: r.color ?? null,
          position: r.position ?? 0,
        })),
      )
      .onConflictDoUpdate({
        target: schema.roles.id,
        set: {
          name: sql`excluded.name`,
          color: sql`excluded.color`,
          position: sql`excluded.position`,
          updatedAt: new Date(),
        },
      });

    // 3. Upsert server_member_roles
    await this.db
      .insert(schema.serverMemberRoles)
      .values(
        discordRoles.map((r) => ({
          memberId,
          roleId: r.id,
        })),
      )
      .onConflictDoNothing();
  }
}
