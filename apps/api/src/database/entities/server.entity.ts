import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const servers = pgTable(
  'servers',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    icon: text('icon'),
    isMain: boolean('is_main').default(false).notNull(),
    type: varchar('type', { length: 50 }).default('other').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    syncFrequencyHours: integer('sync_frequency_hours').default(1).notNull(),
    // Fallback permission behavior when no explicit rule exists
    defaultPermissionPolicy: varchar('default_permission_policy', {
      length: 50,
    })
      .default('deny_all')
      .notNull(),
    disabledReason: text('disabled_reason'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    // At most one row can have is_main = true.
    uniqueIndex('servers_single_main_idx').on(t.isMain).where(sql`${t.isMain}`),
  ],
);
