import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { members } from './member.entity';

export const callbackCodes = pgTable('callback_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** SHA-256 hash of the raw callback code — plaintext is never stored */
  codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
  clientId: uuid('client_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  redirectUri: text('redirect_uri').notNull(),
  memberId: varchar('member_id', { length: 255 })
    .references(() => members.id)
    .notNull(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
