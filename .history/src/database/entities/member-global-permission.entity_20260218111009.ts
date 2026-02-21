import {
  pgTable,
  varchar,
  integer,
  primaryKey,
  timestamp,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';
import { permissions } from './permission.entity';

export const memberGlobalPermissions = pgTable(
  'member_global_permissions',
  {
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id)
      .notNull(),
    permissionId: integer('permission_id')
      .references(() => permissions.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.memberId, t.permissionId] }),
  }),
);
