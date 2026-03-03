import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or } from 'drizzle-orm';
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
}
