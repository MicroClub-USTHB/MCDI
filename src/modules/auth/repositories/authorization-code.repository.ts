// src/oauth/repositories/authorization-code.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateAuthorizationCodeDto {
  code: string;
  userId: string;
  projectId?: string;
  serverId?: string;
  clientId: string;
  redirectUri: string;
  expiresAt: Date;
}

@Injectable()
export class AuthorizationCodeRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async findByCode(code: string) {
    const codes = await this.db
      .select()
      .from(schema.authorizationCodes)
      .where(eq(schema.authorizationCodes.code, code))
      .limit(1);

    return codes[0] || null;
  }

  async findByCodeWithUser(code: string) {
    const codes = await this.db
      .select({
        authCode: schema.authorizationCodes,
        user: schema.members,
      })
      .from(schema.authorizationCodes)
      .leftJoin(
        schema.members,
        eq(schema.authorizationCodes.userId, schema.members.id),
      )
      .where(eq(schema.authorizationCodes.code, code))
      .limit(1);

    if (codes.length === 0) {
      return null;
    }

    return {
      ...codes[0].authCode,
      user: codes[0].user,
    };
  }

  async findByCodeAndClient(
    code: string,
    clientId: string,
    redirectUri: string,
  ) {
    const codes = await this.db
      .select()
      .from(schema.authorizationCodes)
      .where(
        and(
          eq(schema.authorizationCodes.code, code),
          eq(schema.authorizationCodes.clientId, clientId),
          eq(schema.authorizationCodes.redirectUri, redirectUri),
        ),
      )
      .limit(1);

    return codes[0] || null;
  }

  async create(data: CreateAuthorizationCodeDto) {
    const codes = await this.db
      .insert(schema.authorizationCodes)
      .values({
        code: data.code,
        userId: data.userId,
        projectId: data.projectId,
        serverId: data.serverId,
        clientId: data.clientId,
        redirectUri: data.redirectUri,
        expiresAt: data.expiresAt,
        used: false,
      })
      .returning();

    return codes[0];
  }

  async markAsUsed(code: string) {
    const codes = await this.db
      .update(schema.authorizationCodes)
      .set({ used: true })
      .where(eq(schema.authorizationCodes.code, code))
      .returning();

    return codes[0] || null;
  }

  async deleteByCode(code: string) {
    await this.db
      .delete(schema.authorizationCodes)
      .where(eq(schema.authorizationCodes.code, code));
  }

  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.authorizationCodes)
      .where(lt(schema.authorizationCodes.expiresAt, now));
  }

  async deleteByUserId(userId: string) {
    await this.db
      .delete(schema.authorizationCodes)
      .where(eq(schema.authorizationCodes.userId, userId));
  }

  async findByUserId(userId: string, limit: number = 100) {
    return this.db
      .select()
      .from(schema.authorizationCodes)
      .where(eq(schema.authorizationCodes.userId, userId))
      .limit(limit);
  }
}
