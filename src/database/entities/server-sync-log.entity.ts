import { pgTable, text, timestamp, varchar, serial } from 'drizzle-orm/pg-core';
import { servers } from './server.entity';

export const serverSyncLogs = pgTable('server_sync_logs', {
  id: serial('id').primaryKey(),
  serverId: varchar('server_id', { length: 255 }).references(() => servers.id).notNull(),
  status: varchar('status', { length: 50 }).notNull(), // success, failure
  message: text('message'),
  startedAt: timestamp('started_at').notNull(),
  finishedAt: timestamp('finished_at'),
});
