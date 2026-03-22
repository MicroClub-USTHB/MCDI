import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lt, gt } from 'drizzle-orm';
import { createHash } from 'crypto';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateSessionDto {
  memberId: string;
  projectId?: string;
  serverId?: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async findById(id: string) {
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .limit(1);

    return sessions[0] || null;
  }

  async findByToken(token: string, tx: DrizzleDB = this.db) {
    const hashedToken = this.hashToken(token);
    const sessions = await tx
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, hashedToken))
      .limit(1);

    return sessions[0] || null;
  }

  async findByTokenWithMember(
    token: string,
    projectId?: string,
    tx: DrizzleDB = this.db,
  ) {
    const hashedToken = this.hashToken(token);
    const sessions = await tx
      .select({
        session: schema.sessions,
        member: schema.members,
      })
      .from(schema.sessions)
      .leftJoin(schema.members, eq(schema.sessions.memberId, schema.members.id))
      .where(
        and(
          eq(schema.sessions.token, hashedToken),
          ...(projectId ? [eq(schema.sessions.projectId, projectId)] : []),
        ),
      )
      .limit(1);

    if (sessions.length === 0) {
      return null;
    }

    return {
      ...sessions[0].session,
      member: sessions[0].member,
    };
  }

  async findByMemberId(memberId: string, limit: number = 100) {
    return this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.memberId, memberId))
      .limit(limit);
  }

  async findValidByToken(token: string, tx: DrizzleDB = this.db) {
    const hashedToken = this.hashToken(token);
    const now = new Date();
    const sessions = await tx
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, hashedToken),
          gt(schema.sessions.expiresAt, now),
        ),
      )
      .limit(1);

    return sessions[0] || null;
  }

  async create(data: CreateSessionDto, tx: DrizzleDB = this.db) {
    const hashedToken = this.hashToken(data.token);
    const sessions = await tx
      .insert(schema.sessions)
      .values({
        memberId: data.memberId,
        projectId: data.projectId,
        serverId: data.serverId,
        token: hashedToken,
        expiresAt: data.expiresAt,
      })
      .returning();

    return sessions[0];
  }

  async deleteById(id: string) {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  }

  async deleteByToken(
    token: string,
    projectId?: string,
    tx: DrizzleDB = this.db,
  ) {
    const hashedToken = this.hashToken(token);
    await tx
      .delete(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, hashedToken),
          ...(projectId ? [eq(schema.sessions.projectId, projectId)] : []),
        ),
      );
  }

  async deleteByMemberId(memberId: string, tx: DrizzleDB = this.db) {
    await tx
      .delete(schema.sessions)
      .where(eq(schema.sessions.memberId, memberId));
  }

  async deleteAllForMember(
    projectId: string,
    memberId: string,
    tx: DrizzleDB = this.db,
  ) {
    await tx
      .delete(schema.sessions)
      .where(
        and(
          eq(schema.sessions.projectId, projectId),
          eq(schema.sessions.memberId, memberId),
        ),
      );
  }

  async deleteExpired(tx: DrizzleDB = this.db) {
    const now = new Date();
    await tx
      .delete(schema.sessions)
      .where(lt(schema.sessions.expiresAt, now));
  }

  async updateExpiration(
    token: string,
    expiresAt: Date,
    tx: DrizzleDB = this.db,
  ) {
    const hashedToken = this.hashToken(token);
    const sessions = await tx
      .update(schema.sessions)
      .set({ expiresAt })
      .where(eq(schema.sessions.token, hashedToken))
      .returning();

    return sessions[0] || null;
  }
}
