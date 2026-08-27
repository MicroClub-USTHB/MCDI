import {
  pgTable,
  serial,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';
import { servers } from './server.entity';

export const memberDepartures = pgTable(
  'member_departures',
  {
    id: serial('id').primaryKey(),
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id, { onDelete: 'cascade' })
      .notNull(),
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id, { onDelete: 'cascade' })
      .notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_member_departures_member_id').on(t.memberId),
    index('idx_member_departures_server_id').on(t.serverId),
    index('idx_member_departures_left_at').on(t.leftAt),
  ],
);
