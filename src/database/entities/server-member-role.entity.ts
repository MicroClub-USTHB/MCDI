import { pgTable, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './role.entity';

export const serverMemberRoles = pgTable('server_member_roles', {
  serverId: varchar('server_id', { length: 255 }).notNull(),
  memberId: varchar('member_id', { length: 255 }).notNull(),
  roleId: varchar('role_id', { length: 255 }).references(() => roles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.serverId, t.memberId, t.roleId] }),
}));
