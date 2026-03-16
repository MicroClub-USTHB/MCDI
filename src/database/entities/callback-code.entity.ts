import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';
import { projects } from './project.entity';
import { servers } from './server.entity';

export const callbackCodes = pgTable('callback_codes', {
  codeHash: varchar('code_hash', { length: 64 }).primaryKey(),
  clientId: uuid('client_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  redirectUri: text('redirect_uri').notNull(),
  memberId: varchar('member_id', { length: 255 })
    .references(() => members.id, { onDelete: 'cascade' })
    .notNull(),
  serverId: varchar('server_id', { length: 255 })
    .references(() => servers.id)
    .notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});