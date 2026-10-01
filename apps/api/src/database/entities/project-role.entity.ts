import { pgTable, uuid, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { roles } from './role.entity';

/**
 * Association table between projects and roles.
 * Defines which Discord roles are allowed to access a given project.
 * If a project has NO entries here, any authenticated user can access it.
 * If it has entries, the user must hold at least one of these roles.
 */
export const projectRoles = pgTable(
  'project_roles',
  {
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    roleId: varchar('role_id', { length: 255 })
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.roleId] }),
  }),
);
