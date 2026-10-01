import {
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import { projects } from './project.entity';

export const authRequests = pgTable('auth_requests', {
  requestId: uuid('request_id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  redirectUri: text('redirect_uri').notNull(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  state: text('state').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
