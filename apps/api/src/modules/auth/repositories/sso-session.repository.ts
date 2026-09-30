import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import * as schema from '../../../database/entities';
import { hashSsoToken } from '../../../common/utils/sso-token.util';

export interface CreateSsoSessionDto {
  memberId: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SsoSessionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(data: CreateSsoSessionDto, tx: DrizzleDB = this.db) {
    const [row] = await tx
      .insert(schema.ssoSessions)
      .values({
        memberId: data.memberId,
        tokenHash: hashSsoToken(data.token),
        expiresAt: data.expiresAt,
      })
      .returning();
    return row;
  }

  /** Find a non-expired SSO session by its plaintext token. */
  async findValidByToken(token: string, tx: DrizzleDB = this.db) {
    const now = new Date();
    const [row] = await tx
      .select()
      .from(schema.ssoSessions)
      .where(
        and(
          eq(schema.ssoSessions.tokenHash, hashSsoToken(token)),
          gt(schema.ssoSessions.expiresAt, now),
        ),
      )
      .limit(1);
    return row || null;
  }

  /** Update last_used_at without changing anything else. */
  async touch(id: string, tx: DrizzleDB = this.db) {
    await tx
      .update(schema.ssoSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.ssoSessions.id, id));
  }

  async deleteByToken(token: string, tx: DrizzleDB = this.db) {
    await tx
      .delete(schema.ssoSessions)
      .where(eq(schema.ssoSessions.tokenHash, hashSsoToken(token)));
  }

  async deleteByMemberId(memberId: string, tx: DrizzleDB = this.db) {
    await tx
      .delete(schema.ssoSessions)
      .where(eq(schema.ssoSessions.memberId, memberId));
  }

  async deleteExpired(tx: DrizzleDB = this.db) {
    const now = new Date();
    await tx
      .delete(schema.ssoSessions)
      .where(lt(schema.ssoSessions.expiresAt, now));
  }
}
