import { pgTable, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './role.entity';
import { members } from './member.entity';
import { index } from 'drizzle-orm/pg-core';

export const serverMemberRoles = pgTable(
  'server_member_roles',
  {
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id)
      .notNull(),
    roleId: varchar('role_id', { length: 255 })
      .references(() => roles.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.memberId, t.roleId] }),
    roleIdIdx: index('server_member_roles_role_id_idx').on(t.roleId),
  }),
);
