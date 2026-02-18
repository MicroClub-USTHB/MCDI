import {
  boolean,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { roles } from './role.entity';
import { uniqueIndex } from 'drizzle-orm/pg-core';
import { index } from 'drizzle-orm/pg-core';

export const roleInheritanceRules = pgTable('role_inheritance_rules', {
  id: serial('id').primaryKey(),
  sourceRoleId: varchar('source_role_id', { length: 255 })
    .references(() => roles.id)
    .notNull(),
  targetScope: varchar('target_scope', { length: 20 })
    .default('all')
    .notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
},
(t) => ({
    sourceRoleUniqueIdx: uniqueIndex(
      'role_inheritance_rules_source_role_id_uidx',
    ).on(t.sourceRoleId),
    enabledScopeIdx: index('role_inheritance_rules_enabled_scope_idx').on(
      t.enabled,
      t.targetScope,
    ),
  }),);
