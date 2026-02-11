import { pgTable, text, timestamp, varchar, uuid, boolean } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  apiKeyCreatedAt: timestamp('api_key_created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** true = internal MicroClub platform (uses main server), false = external client app (uses provided server) */
  isInternal: boolean('is_internal').default(false).notNull(),
  webhookUrl: text('webhook_url'),
  redirectUri: text('redirect_uri'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
