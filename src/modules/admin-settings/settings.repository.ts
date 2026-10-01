import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { appSettings, AppSettingsRow } from '../../database/entities';

/** The knob columns that can be written; `null` clears the override. */
export interface SettingsPatchColumns {
  permissionCacheTtlMs?: number | null;
  statsCacheTtlMs?: number | null;
  memberActivityThresholdDays?: number | null;
  maxWebhooksPerProject?: number | null;
}

const SINGLETON_ID = 1;

@Injectable()
export class SettingsRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /** The single settings row, or null before it has ever been written. */
  async find(): Promise<AppSettingsRow | null> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, SINGLETON_ID))
      .limit(1);
    return row ?? null;
  }

  /** Upsert the singleton row, merging `patch` over whatever is stored. */
  async upsert(
    patch: SettingsPatchColumns,
    updatedBy: string | null,
  ): Promise<AppSettingsRow> {
    const now = new Date();
    const [row] = await this.db
      .insert(appSettings)
      .values({ id: SINGLETON_ID, ...patch, updatedBy, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { ...patch, updatedBy, updatedAt: now },
      })
      .returning();
    return row;
  }

  /** Clear every override back to the environment defaults. */
  async reset(updatedBy: string | null): Promise<AppSettingsRow> {
    return this.upsert(
      {
        permissionCacheTtlMs: null,
        statsCacheTtlMs: null,
        memberActivityThresholdDays: null,
        maxWebhooksPerProject: null,
      },
      updatedBy,
    );
  }
}
