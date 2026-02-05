import { pgTable, text, timestamp, varchar, uuid } from 'drizzle-orm/pg-core';
import { members } from './member.entity';

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: varchar('member_id', { length: 255 }).references(() => members.id).notNull(),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
