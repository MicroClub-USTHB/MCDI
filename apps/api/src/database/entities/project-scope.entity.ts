import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './project.entity';

export const projectScopes = pgTable('project_scopes', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
