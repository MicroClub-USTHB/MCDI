import {
  pgTable,
  timestamp,
  varchar,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { servers } from './server.entity';
import { index } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: varchar('id', { length: 255 }).primaryKey(),
  serverId: varchar('server_id', { length: 255 })
    .references(() => servers.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  color: integer('color'),
  hoist: boolean('hoist').default(false),
  position: integer('position').default(0),
  managed: boolean('managed').default(false),
  mentionable: boolean('mentionable').default(false),
  isGlobal: boolean('is_global').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
},
(t) => ({
  serverIdIdx: index('roles_server_id_idx').on(t.serverId),
})
);
