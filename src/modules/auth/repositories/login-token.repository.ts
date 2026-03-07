import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateLoginTokenDto {
  token: string;
  projectId: string;
  serverId: string;
  redirectUri: string;
  expiresAt: Date;
}

@Injectable()
export class LoginTokenRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  /**
   * Create a new login token
   */
  async create(data: CreateLoginTokenDto) {
    const tokens = await this.db
      .insert(schema.loginTokens)
      .values({
        token: data.token,
        projectId: data.projectId,
        serverId: data.serverId,
        redirectUri: data.redirectUri,
        expiresAt: data.expiresAt,
      })
      .returning();

    return tokens[0];
  }

  /**
   * Find a valid (not expired) login token
   */
  async findValid(token: string) {
    const now = new Date();
    const tokens = await this.db
      .select()
      .from(schema.loginTokens)
      .where(eq(schema.loginTokens.token, token))
      .limit(1);

    const found = tokens[0];
    if (!found || found.expiresAt <= now) {
      return null;
    }

    return found;
  }

  /**
   * Delete expired login tokens (cleanup)
   */
  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.loginTokens)
      .where(lt(schema.loginTokens.expiresAt, now));
  }
}
