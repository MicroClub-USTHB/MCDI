import {
  boolean,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { roles } from './role.entity';

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
});
