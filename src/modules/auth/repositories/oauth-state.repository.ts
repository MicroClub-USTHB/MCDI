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
  clientState?: string;
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
        clientState: data.clientState,
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
   * Atomically find and consume a valid OAuth state token.
   * Sets used=true in the same UPDATE query to prevent races where
   * concurrent callbacks could both pass a prior validity check.
   */
  async consumeValid(state: string) {
    const [row] = await this.db
      .update(schema.oauthStates)
      .set({ used: 'true' })
      .where(
        and(
          eq(schema.oauthStates.state, state),
          eq(schema.oauthStates.used, 'false'),
          gt(schema.oauthStates.expiresAt, new Date()),
        ),
      )
      .returning();

    return row ?? null;
  }

  // Look up an OAuth state row by its token regardless of used/expired status.
  // Used to recover redirectUri and clientState for error redirects.
  async findByState(state: string) {
    const [row] = await this.db
      .select()
      .from(schema.oauthStates)
      .where(eq(schema.oauthStates.state, state))
      .limit(1);

    return row ?? null;
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
