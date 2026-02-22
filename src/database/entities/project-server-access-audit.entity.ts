import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { servers } from './server.entity';
import type { ProjectServerOperations } from './project-server.entity';

export const projectServerAccessActionEnum = pgEnum(
  'project_server_access_action',
  ['GRANT', 'UPDATE', 'REVOKE'],
);

export const projectServerAccessAudit = pgTable(
  'project_server_access_audit',
  {
    id: serial('id').primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id)
      .notNull(),
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id)
      .notNull(),
    action: projectServerAccessActionEnum('action').notNull(),
    operationsBefore: jsonb(
      'operations_before',
    ).$type<ProjectServerOperations | null>(),
    operationsAfter: jsonb(
      'operations_after',
    ).$type<ProjectServerOperations | null>(),
    changedBy: varchar('changed_by', { length: 255 }).notNull(),
    changedAt: timestamp('changed_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdIdx: index('project_server_access_audit_project_id_idx').on(
      t.projectId,
    ),
    serverIdIdx: index('project_server_access_audit_server_id_idx').on(
      t.serverId,
    ),
    changedAtIdx: index('project_server_access_audit_changed_at_idx').on(
      t.changedAt,
    ),
  }),
);
