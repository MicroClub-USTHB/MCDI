import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const members = pgTable('members', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull(),
  globalName: varchar('global_name', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  // Admin-set display-name override. Unlike `displayName` (rewritten from the
  // Discord guild nickname on every sync), this is owned by the settings API
  // and never touched by sync.
  preferredName: varchar('preferred_name', { length: 255 }),
  avatar: text('avatar'),
  email: varchar('email', { length: 255 }),
  isClubMember: boolean('is_club_member').default(false).notNull(),
  isSystemAdmin: boolean('is_system_admin').default(false).notNull(),
  passwordHash: text('password_hash'),
  joinedAt: timestamp('joined_at'),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
