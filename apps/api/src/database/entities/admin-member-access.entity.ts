import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AccessLevel } from '../../common/permissions/catalog';
import { members } from './member.entity';

/**
 * A per-person override. When a row exists for (member, resource) its level
 * replaces whatever the member's roles grant, so it can raise, lower or deny
 * (`none`) access for that member only.
 */
export const adminMemberAccess = pgTable(
  'admin_member_access',
  {
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id, { onDelete: 'cascade' })
      .notNull(),
    resource: varchar('resource', { length: 32 }).notNull(),
    level: varchar('level', { length: 16 }).$type<AccessLevel>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.resource] }),
    check(
      'admin_member_access_level_check',
      sql`${t.level} in ('none', 'read', 'write', 'manage')`,
    ),
  ],
);

export type AdminMemberAccessRow = typeof adminMemberAccess.$inferSelect;
