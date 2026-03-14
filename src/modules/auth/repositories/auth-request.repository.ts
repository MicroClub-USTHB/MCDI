import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, lt, and, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateAuthRequestDto {
  clientId: string;
  redirectUri: string;
  serverId: string;
  state: string;
  expiresAt: Date;
}

@Injectable()
export class AuthRequestRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async create(data: CreateAuthRequestDto) {
    const [row] = await this.db
      .insert(schema.authRequests)
      .values({
        clientId: data.clientId,
        redirectUri: data.redirectUri,
        serverId: data.serverId,
        state: data.state,
        expiresAt: data.expiresAt,
      })
      .returning();

    return row;
  }

  /**
   * Atomically find and consume a valid auth request.
   * Sets used=true in the same UPDATE query to prevent race conditions
   * where two concurrent requests could both pass a SELECT check.
   */
  async consumeValid(requestId: string) {
    const [row] = await this.db
      .update(schema.authRequests)
      .set({ used: true })
      .where(
        and(
          eq(schema.authRequests.requestId, requestId),
          eq(schema.authRequests.used, false),
          gt(schema.authRequests.expiresAt, new Date()),
        ),
      )
      .returning();

    return row ?? null;
  }

  // Look up any request by ID regardless of used/expired status.
  // Used to recover redirect_uri and state for error redirects.
  async findById(requestId: string) {
    const [row] = await this.db
      .select()
      .from(schema.authRequests)
      .where(eq(schema.authRequests.requestId, requestId))
      .limit(1);

    return row ?? null;
  }

  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.authRequests)
      .where(lt(schema.authRequests.expiresAt, now));
  }
}
