import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import * as databaseModule from '../../database/database.module';
import * as schema from '../../database/entities';
import { hashSessionToken } from '../../common/utils/session-token.util';

@Injectable()
export class SessionRepository {
  constructor(
    @Inject(databaseModule.DRIZZLE)
    private readonly db: databaseModule.DrizzleDB,
  ) {}

  async create(params: {
    token: string;
    memberId: string;
    projectId?: string | null;
    expiresAt: Date;
  }) {
    const tokenHash = hashSessionToken(params.token);
    const [row] = await this.db
      .insert(schema.sessions)
      .values({
        memberId: params.memberId,
        projectId: params.projectId ?? null,
        token: tokenHash,
        expiresAt: params.expiresAt,
      })
      .returning();

    return row;
  }

  async findByTokenWithMember(token: string, projectId: string) {
    const tokenHash = hashSessionToken(token);
    const [row] = await this.db
      .select({
        sessionId: schema.sessions.id,
        memberId: schema.sessions.memberId,
        expiresAt: schema.sessions.expiresAt,
        projectId: schema.sessions.projectId,
      })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, tokenHash),
          eq(schema.sessions.projectId, projectId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async deleteByToken(token: string, projectId: string) {
    const tokenHash = hashSessionToken(token);
    const [row] = await this.db
      .delete(schema.sessions)
      .where(
        and(
          eq(schema.sessions.token, tokenHash),
          eq(schema.sessions.projectId, projectId),
        ),
      )
      .returning();

    return row ?? null;
  }

  async deleteAllForMember(projectId: string, memberId: string) {
    const rows = await this.db
      .delete(schema.sessions)
      .where(
        and(
          eq(schema.sessions.projectId, projectId),
          eq(schema.sessions.memberId, memberId),
        ),
      )
      .returning();

    return rows.length;
  }
}
