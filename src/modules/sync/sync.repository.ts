import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';
import { serverSyncLogs } from '../../database/entities/server-sync-log.entity';
import { eq, and, desc } from 'drizzle-orm';

@Injectable()
export class SyncRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createLog(
    serverId: string,
    syncType: 'full' | 'incremental' | 'manual',
    status: 'in_progress' | 'success' | 'failed',
    startedAt: Date,
  ): Promise<typeof serverSyncLogs.$inferSelect> {
    const [log] = await this.db
      .insert(serverSyncLogs)
      .values({
        serverId,
        syncType,
        status,
        startedAt,
        membersSynced: 0,
        rolesSynced: 0,
      })
      .returning();
    return log;
  }

  async updateLog(
    id: number,
    updates: Partial<typeof serverSyncLogs.$inferInsert>,
  ): Promise<typeof serverSyncLogs.$inferSelect | null> {
    const [log] = await this.db
      .update(serverSyncLogs)
      .set({ ...updates, finishedAt: updates.finishedAt ?? null })
      .where(eq(serverSyncLogs.id, id))
      .returning();
    return log ?? null;
  }

  async getInProgressLog(
    serverId: string,
  ): Promise<typeof serverSyncLogs.$inferSelect | null> {
    const [log] = await this.db
      .select()
      .from(serverSyncLogs)
      .where(
        and(
          eq(serverSyncLogs.serverId, serverId),
          eq(serverSyncLogs.status, 'in_progress'),
        ),
      )
      .limit(1);
    return log ?? null;
  }

  async getLatestLog(
    serverId: string,
  ): Promise<typeof serverSyncLogs.$inferSelect | null> {
    const [log] = await this.db
      .select()
      .from(serverSyncLogs)
      .where(eq(serverSyncLogs.serverId, serverId))
      .orderBy(desc(serverSyncLogs.startedAt))
      .limit(1);
    return log ?? null;
  }
}
