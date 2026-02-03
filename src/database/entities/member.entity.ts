import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const members = pgTable('members', {
  id: varchar('id', { length: 255 }).primaryKey(), // Discord ID
  username: varchar('username', { length: 255 }).notNull(),
  globalName: varchar('global_name', { length: 255 }),
  avatar: text('avatar'),
  email: varchar('email', { length: 255 }),
  joinedAt: timestamp('joined_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
