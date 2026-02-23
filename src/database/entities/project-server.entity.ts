import { pgTable, uuid, varchar, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { servers } from './server.entity';
import { timestamp } from 'drizzle-orm/pg-core';
import { index } from 'drizzle-orm/pg-core';

export type ProjectServerOperations = {
  READ: boolean;
  SEND_MESSAGES: boolean;
  MANAGE_WEBHOOKS: boolean;
};

export const projectServers = pgTable(
  'project_servers',
  {
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id)
      .notNull(),
    operations: jsonb('operations')
      .$type<ProjectServerOperations>()
      .default({
        READ: true,
        SEND_MESSAGES: false,
        MANAGE_WEBHOOKS: false,
      })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.serverId] }),
    projectIdIdx: index('project_servers_project_id_idx').on(t.projectId),
    serverIdIdx: index('project_servers_server_id_idx').on(t.serverId),
  }),
);
