import { pgTable, text, timestamp, varchar, uuid, boolean } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull().unique(),
  apiKeyPrefix: varchar('api_key_prefix', { length: 40 }),
  apiKeyLastUsedAt: timestamp('api_key_last_used_at', { withTimezone: true }),
  apiKeyCreatedAt: timestamp('api_key_created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** true = internal MicroClub platform (uses main server), false = external client app (uses provided server) */
  isInternal: boolean('is_internal').default(false).notNull(),
  webhookUrl: text('webhook_url'),
  redirectUri: text('redirect_uri'),
  isActive : boolean('is_active').default(true).notNull(),
  webhokUrl: text('webhook_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
