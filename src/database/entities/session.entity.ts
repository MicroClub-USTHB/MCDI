import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
} from 'drizzle-orm/pg-core';
import { members } from './member.entity';
import { projects } from './project.entity';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: varchar('member_id', { length: 255 })
      .references(() => members.id)
      .notNull(),
    /** The project (platform) this session was created for */
    projectId: uuid('project_id').references(() => projects.id),
    /** The Discord server ID verified against during login */
    serverId: varchar('server_id', { length: 255 }),
    token: text('token').notNull().unique(),
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).unique(),
    clientUserAgent: text('client_user_agent'),
    clientIpAddress: varchar('client_ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_sessions_refresh_token')
      .on(t.refreshTokenHash)
      .where(sql`${t.refreshTokenHash} IS NOT NULL`),
  ],
);
