import {
  check,
  integer,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Runtime-editable operational settings, layered over the env-var defaults in
 * `app.config.ts`. Exactly one row exists (`id = 1`); a `NULL` column means
 * "fall back to the environment default". `SettingsService` is the single
 * reader — consumers pull the effective value from it, not `ConfigService`.
 *
 * Only knobs that are safe to change without a restart live here. Secrets and
 * boot-time config (Discord credentials, global throttler) stay env-only and
 * are surfaced read-only by the settings API.
 */
export const appSettings = pgTable(
  'app_settings',
  {
    id: integer('id').primaryKey().default(1),
    permissionCacheTtlMs: integer('permission_cache_ttl_ms'),
    statsCacheTtlMs: integer('stats_cache_ttl_ms'),
    memberActivityThresholdDays: integer('member_activity_threshold_days'),
    maxWebhooksPerProject: integer('max_webhooks_per_project'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Discord member id of the admin who last wrote a setting; kept loose (no FK)
    // so a settings row survives a member row being pruned.
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (t) => [check('app_settings_single_row', sql`${t.id} = 1`)],
);

export type AppSettingsRow = typeof appSettings.$inferSelect;
