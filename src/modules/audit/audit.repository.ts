import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, lt, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { auditLogs } from '../../database/entities';

export interface InsertAuditLog {
  actorId?: string | null;
  actorName?: string | null;
  actionType: (typeof schema.auditActionTypeEnum.enumValues)[number];
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: (typeof schema.auditSeverityEnum.enumValues)[number];
}

export interface AuditFilters {
  dateFrom?: string;
  dateTo?: string;
  actorId?: string;
  actionType?: string;
  severity?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class AuditRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async insert(entry: InsertAuditLog): Promise<void> {
    await this.db.insert(auditLogs).values({
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? null,
      actionType: entry.actionType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      severity: entry.severity ?? 'info',
    });
  }

  async findPaginated(
    filters: AuditFilters,
  ): Promise<{ rows: (typeof auditLogs.$inferSelect)[]; total: number }> {
    const conditions: SQL[] = [];

    if (filters.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));
    }
    if (filters.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters.actionType) {
      conditions.push(
        eq(
          auditLogs.actionType,
          filters.actionType as (typeof schema.auditActionTypeEnum.enumValues)[number],
        ),
      );
    }
    if (filters.severity) {
      conditions.push(
        eq(
          auditLogs.severity,
          filters.severity as (typeof schema.auditSeverityEnum.enumValues)[number],
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await this.db
      .select({ value: count() })
      .from(auditLogs)
      .where(where);

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);

    return { rows, total: totalResult?.value ?? 0 };
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const deleted = await this.db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, date))
      .returning({ id: auditLogs.id });

    return deleted.length;
  }
}
