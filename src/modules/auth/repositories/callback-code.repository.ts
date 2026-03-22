import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateCallbackCodeDto {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  memberId: string;
  serverId: string;
  expiresAt: Date;
}

@Injectable()
export class CallbackCodeRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(data: CreateCallbackCodeDto) {
    const [row] = await this.db
      .insert(schema.callbackCodes)
      .values({
        codeHash: data.codeHash,
        clientId: data.clientId,
        redirectUri: data.redirectUri,
        memberId: data.memberId,
        serverId: data.serverId,
        expiresAt: data.expiresAt,
      })
      .returning();

    return row;
  }

  /**
   * Atomically find and consume a valid callback code by its hash.
   * Sets used=true in a single UPDATE to prevent replay attacks.
   */
  async consumeValid(
    codeHash: string,
    clientId: string,
    redirectUri: string,
    tx: DrizzleDB = this.db,
  ) {
    const [row] = await tx
      .update(schema.callbackCodes)
      .set({ used: true })
      .where(
        and(
          eq(schema.callbackCodes.codeHash, codeHash),
          eq(schema.callbackCodes.clientId, clientId),
          eq(schema.callbackCodes.redirectUri, redirectUri),
          eq(schema.callbackCodes.used, false),
          gt(schema.callbackCodes.expiresAt, new Date()),
        ),
      )
      .returning();

    return row ?? null;
  }

  async deleteExpired() {
    await this.db
      .delete(schema.callbackCodes)
      .where(lt(schema.callbackCodes.expiresAt, new Date()));
  }
}
