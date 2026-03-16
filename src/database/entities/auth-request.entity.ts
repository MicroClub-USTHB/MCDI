import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { servers } from './server.entity';

export const authRequests = pgTable('auth_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestId: varchar('request_id', { length: 128 }).notNull().unique(),
  clientId: uuid('client_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  redirectUri: text('redirect_uri').notNull(),
  state: text('state'),
  serverId: varchar('server_id', { length: 255 })
    .references(() => servers.id)
    .notNull(),
  used: boolean('used').default(false).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});