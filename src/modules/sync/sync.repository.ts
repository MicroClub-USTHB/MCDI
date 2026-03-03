import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';
import { serverSyncLogs } from '../../database/entities/server-sync-log.entity';
import { syncChangeDetails } from '../../database/entities/sync-change-detail.entity';
import { eq, and, desc, sql } from 'drizzle-orm';

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

  async getLogs(
    serverId: string,
    limit = 20,
    offset = 0,
  ): Promise<(typeof serverSyncLogs.$inferSelect)[]> {
    return this.db
      .select()
      .from(serverSyncLogs)
      .where(eq(serverSyncLogs.serverId, serverId))
      .orderBy(desc(serverSyncLogs.startedAt))
      .limit(limit)
      .offset(offset);
  }

  async countLogs(serverId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(serverSyncLogs)
      .where(eq(serverSyncLogs.serverId, serverId));
    return result?.count ?? 0;
  }

  // ─── Sync Change Details ────────────────────────────────────

  async createChangeDetail(data: {
    syncLogId: number;
    serverId: string;
    entityType: string;
    entityId: string;
    action: string;
    description?: string;
    details?: string;
  }): Promise<typeof syncChangeDetails.$inferSelect> {
    const [row] = await this.db
      .insert(syncChangeDetails)
      .values(data)
      .returning();
    return row;
  }

  async createChangeDetails(
    items: {
      syncLogId: number;
      serverId: string;
      entityType: string;
      entityId: string;
      action: string;
      description?: string;
      details?: string;
    }[],
  ): Promise<void> {
    if (!items.length) return;
    await this.db.insert(syncChangeDetails).values(items);
  }

  async getChangeDetails(
    syncLogId: number,
    limit = 100,
    offset = 0,
  ): Promise<(typeof syncChangeDetails.$inferSelect)[]> {
    return this.db
      .select()
      .from(syncChangeDetails)
      .where(eq(syncChangeDetails.syncLogId, syncLogId))
      .orderBy(desc(syncChangeDetails.id))
      .limit(limit)
      .offset(offset);
  }

  async countChangeDetails(syncLogId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(syncChangeDetails)
      .where(eq(syncChangeDetails.syncLogId, syncLogId));
    return result?.count ?? 0;
  }
}
