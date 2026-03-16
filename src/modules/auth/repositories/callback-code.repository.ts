import { Injectable, Inject } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
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
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async create(data: CreateCallbackCodeDto) {
    const codes = await this.db
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

    return codes[0];
  }

  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.callbackCodes)
      .where(lt(schema.callbackCodes.expiresAt, now));
  }
}