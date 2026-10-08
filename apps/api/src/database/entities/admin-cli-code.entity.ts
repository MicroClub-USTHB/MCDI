import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';

/**
 * One-time codes handed to a CLI (m-forge) at the end of an admin Discord
 * login, exchanged with PKCE for an admin session at `POST /auth/admin/token`.
 */
export const adminCliCodes = pgTable('admin_cli_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** SHA-256 hash of the raw code — plaintext is never stored */
  codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
  memberId: varchar('member_id', { length: 255 })
    .references(() => members.id, { onDelete: 'cascade' })
    .notNull(),
  /** PKCE S256 challenge carried over from the admin OAuth state */
  codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
