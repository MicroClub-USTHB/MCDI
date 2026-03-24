import { Injectable, Inject } from '@nestjs/common';
import { eq, and, lt, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import * as schema from '../../../database/entities';
import { hashSessionToken } from '../../../common/utils/session-token.util';

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

  async findById(id: string) {
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .limit(1);

    return sessions[0] || null;
  }

  async findByToken(token: string, tx: DrizzleDB = this.db) {
    const hashedToken = hashSessionToken(token);
    const sessions = await tx
      .select()
      .from(schema.sessions)
      .where(inArray(schema.sessions.token, tokenCandidates))
      .limit(1);

    return sessions[0] || null;
  }

  async findByTokenWithMember(
    token: string,
    projectId?: string,
    tx: DrizzleDB = this.db,
  ) {
    const hashedToken = hashSessionToken(token);
    const sessions = await tx
      .select({
        session: schema.sessions,
        member: schema.members,
      })
      .from(schema.sessions)
      .leftJoin(schema.members, eq(schema.sessions.memberId, schema.members.id))
      .where(
        projectId
          ? and(
              inArray(schema.sessions.token, tokenCandidates),
              eq(schema.sessions.projectId, projectId),
            )
          : inArray(schema.sessions.token, tokenCandidates),
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
    const hashedToken = hashSessionToken(token);
    const now = new Date();
    const tokenCandidates = getSessionTokenCandidates(token);
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          inArray(schema.sessions.token, tokenCandidates),
          gt(schema.sessions.expiresAt, now),
        ),
      )
      .limit(1);

    return sessions[0] || null;
  }

  async create(data: CreateSessionDto, tx: DrizzleDB = this.db) {
    const hashedToken = hashSessionToken(data.token);
    const sessions = await tx
      .insert(schema.sessions)
      .values({
        memberId: data.memberId,
        projectId: data.projectId,
        serverId: data.serverId,
        token: hashSessionToken(data.token),
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
    const hashedToken = hashSessionToken(token);
    await tx
      .delete(schema.sessions)
      .where(
        projectId
          ? and(
              inArray(schema.sessions.token, tokenCandidates),
              eq(schema.sessions.projectId, projectId),
            )
          : inArray(schema.sessions.token, tokenCandidates),
      );
  }

  async deleteByMemberId(memberId: string, tx: DrizzleDB = this.db) {
    await tx
      .delete(schema.sessions)
      .where(eq(schema.sessions.memberId, memberId));
  }

  async deleteAllForMember(projectId: string, memberId: string) {
    await this.db
      .delete(schema.sessions)
      .where(
        and(
          eq(schema.sessions.projectId, projectId),
          eq(schema.sessions.memberId, memberId),
        ),
      );
  }

  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.sessions)
      .where(lt(schema.sessions.expiresAt, now));
  }

  async updateExpiration(
    token: string,
    expiresAt: Date,
    tx: DrizzleDB = this.db,
  ) {
    const hashedToken = hashSessionToken(token);
    const sessions = await tx
      .update(schema.sessions)
      .set({ expiresAt })
      .where(inArray(schema.sessions.token, tokenCandidates))
      .returning();

    return sessions[0] || null;
  }
}
