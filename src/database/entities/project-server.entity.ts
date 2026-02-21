import { pgTable, uuid, varchar, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { servers } from './server.entity';

export const projectServers = pgTable(
  'project_servers',
  {
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id)
      .notNull(),
    operations: jsonb('operations').default({ read: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.serverId] }),
  }),
);
