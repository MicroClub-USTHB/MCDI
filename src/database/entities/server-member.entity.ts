import {
  pgTable,
  varchar,
  timestamp,
  primaryKey,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { servers } from './server.entity';
import { members } from './member.entity';

export const serverMembers = pgTable(
  'server_members',
  {
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id)
      .notNull(),
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id)
      .notNull(),
    joinedAt: timestamp('joined_at'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.serverId, t.memberId] }),
  }),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.memberId] }),
    index('idx_server_members_member_id').on(t.memberId),
  ],
);
