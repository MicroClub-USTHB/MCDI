import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { webhooks } from '../../database/entities';

export type WebhookRow = typeof webhooks.$inferSelect;

export interface CreateWebhookData {
  discordWebhookId: string;
  projectId: string;
  serverId: string;
  channelId: string;
  name: string;
  avatar: string | null;
  encryptedToken: string;
}

export interface UpdateWebhookData {
  name?: string;
  avatar?: string | null;
}

export interface ListWebhooksFilter {
  projectId: string;
  serverId?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class WebhooksRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: CreateWebhookData): Promise<WebhookRow> {
    const [row] = await this.db.insert(webhooks).values(data).returning();
    return row;
  }

  async findById(id: string): Promise<WebhookRow | null> {
    const [row] = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);
    return row ?? null;
  }

  async countByProject(projectId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(webhooks)
      .where(eq(webhooks.projectId, projectId));

    return total;
  }

  async findByProject(
    filter: ListWebhooksFilter,
  ): Promise<{ rows: WebhookRow[]; total: number }> {
    const where = filter.serverId
      ? and(
          eq(webhooks.projectId, filter.projectId),
          eq(webhooks.serverId, filter.serverId),
        )
      : eq(webhooks.projectId, filter.projectId);

    const rows = await this.db
      .select()
      .from(webhooks)
      .where(where)
      .orderBy(desc(webhooks.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(webhooks)
      .where(where);

    return { rows, total };
  }

  async update(
    id: string,
    data: UpdateWebhookData,
  ): Promise<WebhookRow | null> {
    const [row] = await this.db
      .update(webhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async recordExecution(id: string): Promise<boolean> {
    const now = new Date();
    const [updated] = await this.db
      .update(webhooks)
      .set({
        usageCount: sql`${webhooks.usageCount} + 1`,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(webhooks.id, id))
      .returning({ id: webhooks.id });

    return updated !== undefined;
  }
}
