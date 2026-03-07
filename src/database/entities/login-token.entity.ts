import { pgTable, text, timestamp, varchar, uuid } from 'drizzle-orm/pg-core';
import { projects } from './project.entity';

export const loginTokens = pgTable('login_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  redirectUri: text('redirect_uri').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
