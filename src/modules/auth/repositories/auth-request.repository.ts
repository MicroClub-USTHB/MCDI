import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, lt, and } from 'drizzle-orm';
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

  async findValid(requestId: string) {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(schema.authRequests)
      .where(
        and(
          eq(schema.authRequests.requestId, requestId),
          eq(schema.authRequests.used, false),
        ),
      )
      .limit(1);

    if (!row || row.expiresAt <= now) {
      return null;
    }

    return row;
  }

  async markAsUsed(requestId: string) {
    await this.db
      .update(schema.authRequests)
      .set({ used: true })
      .where(eq(schema.authRequests.requestId, requestId));
  }

  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.authRequests)
      .where(lt(schema.authRequests.expiresAt, now));
  }
}
