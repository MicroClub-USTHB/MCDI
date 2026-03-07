import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateOAuthStateDto {
  state: string;
  projectId: string;
  serverId: string;
  redirectUri: string;
  expiresAt: Date;
}

@Injectable()
export class OAuthStateRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  /**
   * Create a new OAuth state token
   */
  async create(data: CreateOAuthStateDto) {
    const states = await this.db
      .insert(schema.oauthStates)
      .values({
        state: data.state,
        projectId: data.projectId,
        serverId: data.serverId,
        redirectUri: data.redirectUri,
        expiresAt: data.expiresAt,
      })
      .returning();

    return states[0];
  }

  /**
   * Find a valid (unused and not expired) state token
   */
  async findValidState(state: string) {
    const now = new Date();
    const states = await this.db
      .select()
      .from(schema.oauthStates)
      .where(
        and(
          eq(schema.oauthStates.state, state),
          eq(schema.oauthStates.used, 'false'),
          gt(schema.oauthStates.expiresAt, now),
        ),
      )
      .limit(1);

    return states[0] || null;
  }

  /**
   * Mark a state token as used
   */
  async markAsUsed(state: string) {
    await this.db
      .update(schema.oauthStates)
      .set({ used: 'true' })
      .where(eq(schema.oauthStates.state, state));
  }

  /**
   * Delete expired state tokens (cleanup)
   */
  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.oauthStates)
      .where(lt(schema.oauthStates.expiresAt, now));
  }
}
