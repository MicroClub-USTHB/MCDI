import {
  pgTable,
  text,
  timestamp,
  varchar,
  serial,
  integer,
} from 'drizzle-orm/pg-core';
import { servers } from './server.entity';

export const serverSyncLogs = pgTable('server_sync_logs', {
  id: serial('id').primaryKey(),
  serverId: varchar('server_id', { length: 255 })
    .references(() => servers.id)
    .notNull(),
  status: varchar('status', { length: 50 }).notNull(), // success, failure
  syncType: varchar('sync_type', { length: 50 }).default('full').notNull(), // 'full', 'incremental', 'manual'
  membersSynced: integer('members_synced').default(0).notNull(),
  rolesSynced: integer('roles_synced').default(0).notNull(),
  message: text('message'),
  startedAt: timestamp('started_at').notNull(),
  finishedAt: timestamp('finished_at'),
});
