import { pgTable, text, timestamp, varchar, uuid } from 'drizzle-orm/pg-core';
import { projects } from './project.entity';

export const oauthStates = pgTable('oauth_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  state: varchar('state', { length: 500 }).notNull().unique(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  serverId: varchar('server_id', { length: 255 }).notNull(),
  redirectUri: text('redirect_uri').notNull(),
  // The platform's original state value, passed through to the final redirect
  clientState: text('client_state'),
  used: varchar('used', { length: 10 }).default('false').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
