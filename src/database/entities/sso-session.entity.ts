import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';

/**
 * Global, browser-scoped SSO session shared across projects.
 *
 * The `mcdi_sso` httpOnly cookie carries the plaintext token; only the
 * SHA-256 hash is stored. Every project session created via SSO carries
 * the same `member_id`, which is how `/auth/sso/sessions` enumerates
 * "all project sessions under this SSO session".
 */
export const ssoSessions = pgTable(
  'sso_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_sso_sessions_member_id').on(t.memberId),
    index('idx_sso_sessions_token_hash').on(t.tokenHash),
    index('idx_sso_sessions_expires_at').on(t.expiresAt),
  ],
);

export type SsoSession = typeof ssoSessions.$inferSelect;
