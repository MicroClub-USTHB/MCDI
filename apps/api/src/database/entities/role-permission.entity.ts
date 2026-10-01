import { pgTable, integer, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './role.entity';
import { permissions } from './permission.entity';

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: varchar('role_id', { length: 255 })
      .references(() => roles.id)
      .notNull(),
    permissionId: integer('permission_id')
      .references(() => permissions.id)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
