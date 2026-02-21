import { pgTable, integer, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './role.entity';
import { permissions } from './permission.entity';
import { index } from 'drizzle-orm/pg-core';

export const rolePermissions = pgTable('role_permissions', {
  roleId: varchar('role_id', { length: 255 }).references(() => roles.id).notNull(),
  permissionId: integer('permission_id').references(() => permissions.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  permissionIdIdx: index()('role_permissions_permission_id_idx').on(
      t.permissionId,
    ),
}));
