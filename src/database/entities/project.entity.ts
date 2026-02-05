import { pgTable, text, timestamp, varchar, uuid } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  apiKeyCreatedAt: timestamp('api_key_created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
