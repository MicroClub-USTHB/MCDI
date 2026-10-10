import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import type { GrantLevel } from '../../common/permissions/catalog';
import { roles } from './role.entity';

/**
 * The level a Discord role of the main server holds on an admin resource.
 * Exactly one row per (role, resource). `none` is never stored here: removing
 * a grant deletes the row. Resource keys are validated against the catalog in
 * code (`common/permissions/catalog.ts`).
 */
export const adminRoleAccess = pgTable(
  'admin_role_access',
  {
    roleId: varchar('role_id', { length: 255 })
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    resource: varchar('resource', { length: 32 }).notNull(),
    level: varchar('level', { length: 16 }).$type<GrantLevel>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Member id of the root admin; loose (no FK) like app_settings.updated_by.
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.resource] }),
    check(
      'admin_role_access_level_check',
      sql`${t.level} in ('read', 'write', 'manage')`,
    ),
  ],
);

export type AdminRoleAccessRow = typeof adminRoleAccess.$inferSelect;
