import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';

export const auditActionTypeEnum = pgEnum('audit_action_type', [
  'auth',
  'project',
  'server',
  'role',
  'webhook',
  'member',
  'sync',
  'permission',
]);

export const auditSeverityEnum = pgEnum('audit_severity', [
  'info',
  'warning',
  'error',
]);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: varchar('actor_id', { length: 255 }).references(
      () => members.id,
      { onDelete: 'set null' },
    ),
    actorName: varchar('actor_name', { length: 255 }),
    actionType: auditActionTypeEnum('action_type').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    details: jsonb('details').$type<Record<string, unknown> | null>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    severity: auditSeverityEnum('severity').default('info').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    actorIdIdx: index('idx_audit_logs_actor_id').on(t.actorId),
    actionTypeIdx: index('idx_audit_logs_action_type').on(t.actionType),
    createdAtIdx: index('idx_audit_logs_created_at').on(t.createdAt),
    entityIdx: index('idx_audit_logs_entity').on(t.entityType, t.entityId),
    severityIdx: index('idx_audit_logs_severity').on(t.severity),
  }),
);
