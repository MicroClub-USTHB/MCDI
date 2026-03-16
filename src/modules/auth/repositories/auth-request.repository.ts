import { Injectable, Inject } from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateAuthRequestDto {
  requestId: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  serverId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthRequestRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async create(data: CreateAuthRequestDto) {
    const requests = await this.db
      .insert(schema.authRequests)
      .values({
        requestId: data.requestId,
        clientId: data.clientId,
        redirectUri: data.redirectUri,
        state: data.state,
        serverId: data.serverId,
        expiresAt: data.expiresAt,
      })
      .returning();

    return requests[0];
  }

  async findValidRequest(requestId: string) {
    const now = new Date();
    const requests = await this.db
      .select()
      .from(schema.authRequests)
      .where(
        and(
          eq(schema.authRequests.requestId, requestId),
          eq(schema.authRequests.used, false),
          gt(schema.authRequests.expiresAt, now),
        ),
      )
      .limit(1);

    return requests[0] || null;
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