import { pgTable, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { servers } from './server.entity';
import { members } from './member.entity';
import { index } from 'drizzle-orm/pg-core';

export const serverMembers = pgTable('server_members', {
  serverId: varchar('server_id', { length: 255 }).references(() => servers.id).notNull(),
  memberId: varchar('member_id', { length: 255 }).references(() => members.id).notNull(),
  joinedAt: timestamp('joined_at'),
}, (t) => ({
  pk: primaryKey({ columns: [t.serverId, t.memberId] }),
  memberIdIdx: index('server_members_member_id_idx').on(t.memberId),
}));
