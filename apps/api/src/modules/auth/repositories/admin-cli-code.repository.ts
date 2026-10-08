import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateAdminCliCodeDto {
  codeHash: string;
  memberId: string;
  codeChallenge: string;
  expiresAt: Date;
}

/** One-time codes for the admin CLI login (m-forge), exchanged with PKCE. */
@Injectable()
export class AdminCliCodeRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async create(data: CreateAdminCliCodeDto) {
    const [row] = await this.db
      .insert(schema.adminCliCodes)
      .values(data)
      .returning();
    return row;
  }

  /**
   * Atomically find and consume a valid code by its hash. Sets used=true in
   * the same UPDATE so a code can never be exchanged twice.
   */
  async consumeValid(codeHash: string) {
    const [row] = await this.db
      .update(schema.adminCliCodes)
      .set({ used: true })
      .where(
        and(
          eq(schema.adminCliCodes.codeHash, codeHash),
          eq(schema.adminCliCodes.used, false),
          gt(schema.adminCliCodes.expiresAt, new Date()),
        ),
      )
      .returning();
    return row ?? null;
  }

  async deleteExpired() {
    await this.db
      .delete(schema.adminCliCodes)
      .where(lt(schema.adminCliCodes.expiresAt, new Date()));
  }
}
