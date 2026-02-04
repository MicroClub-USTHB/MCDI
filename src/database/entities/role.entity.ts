import {
  pgTable,
  timestamp,
  varchar,
  integer,
  boolean,
  text,
} from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: varchar('id', { length: 255 }).primaryKey(), // Discord Role ID
  name: varchar('name', { length: 255 }).notNull(),
  color: integer('color'),
  hoist: boolean('hoist').default(false),
  position: integer('position').default(0),
  managed: boolean('managed').default(false),
  mentionable: boolean('mentionable').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
