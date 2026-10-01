import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const adminOauthStates = pgTable('admin_oauth_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  state: varchar('state', { length: 500 }).notNull().unique(),
  used: varchar('used', { length: 10 }).default('false').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
