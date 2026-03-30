import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { serverSyncLogs } from './server-sync-log.entity';
import { servers } from './server.entity';

/**
 * Granular change details for each sync operation.
 * Records individual entity-level changes (member added/removed, role changed, etc.)
 * linked to a parent sync log entry.
 */
export const syncChangeDetails = pgTable(
  'sync_change_details',
  {
    id: serial('id').primaryKey(),
    syncLogId: integer('sync_log_id')
      .references(() => serverSyncLogs.id, { onDelete: 'cascade' })
      .notNull(),
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id)
      .notNull(),
    /** The type of entity that changed: 'member' | 'role' | 'server' */
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    /** The ID of the entity that changed (Discord ID of the member/role) */
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    /** The action that occurred: 'added' | 'removed' | 'updated' | 'deactivated' | 'role_assigned' | 'role_removed' */
    action: varchar('action', { length: 50 }).notNull(),
    /** Human-readable description of the change */
    description: text('description'),
    /** Optional JSON with before/after details */
    details: text('details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_sync_change_details_sync_log_id').on(t.syncLogId),
    index('idx_sync_change_details_server_id').on(t.serverId),
    index('idx_sync_change_details_entity_type').on(t.entityType),
  ],
);
