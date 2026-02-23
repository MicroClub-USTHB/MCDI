import {
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';

export const servers = pgTable('servers', {
  id: varchar('id', { length: 255 }).primaryKey(), // Guild ID
  name: varchar('name', { length: 255 }).notNull(),
  icon: text('icon'),
  isMain: boolean('is_main').default(false).notNull(),
  type: varchar('type', { length: 50 }).default('other').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  syncFrequencyHours: integer('sync_frequency_hours')
    .default(1)
    .notNull(),
  defaultPermissionPolicy: varchar('default_permission_policy', {
    length: 50,
  })
    .default('deny_all')
    .notNull(),
  disabledReason: text('disabled_reason'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
