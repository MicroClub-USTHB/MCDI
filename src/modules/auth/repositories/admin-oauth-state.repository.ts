import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateAdminOAuthStateDto {
  state: string;
  expiresAt: Date;
}

@Injectable()
export class AdminOAuthStateRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

  async create(data: CreateAdminOAuthStateDto) {
    const states = await this.db
      .insert(schema.adminOauthStates)
      .values({ state: data.state, expiresAt: data.expiresAt })
      .returning();
    return states[0];
  }

  async findValidState(state: string) {
    const now = new Date();
    const states = await this.db
      .select()
      .from(schema.adminOauthStates)
      .where(
        and(
          eq(schema.adminOauthStates.state, state),
          eq(schema.adminOauthStates.used, 'false'),
          gt(schema.adminOauthStates.expiresAt, now),
        ),
      )
      .limit(1);
    return states[0] || null;
  }

  async markAsUsed(state: string) {
    await this.db
      .update(schema.adminOauthStates)
      .set({ used: 'true' })
      .where(eq(schema.adminOauthStates.state, state));
  }

  async deleteExpired() {
    const now = new Date();
    await this.db
      .delete(schema.adminOauthStates)
      .where(lt(schema.adminOauthStates.expiresAt, now));
  }
}
