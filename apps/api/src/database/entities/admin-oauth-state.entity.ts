import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const adminOauthStates = pgTable('admin_oauth_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  state: varchar('state', { length: 500 }).notNull().unique(),
  used: varchar('used', { length: 10 }).default('false').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  /**
   * Set only for a CLI login (m-forge): the loopback URL to hand the result
   * back to, and the PKCE S256 challenge the code exchange must match. Null
   * for the admin web panel, which gets a cookie instead.
   */
  redirectUri: text('redirect_uri'),
  codeChallenge: varchar('code_challenge', { length: 128 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
