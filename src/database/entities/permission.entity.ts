import {
  pgTable,
  text,
  timestamp,
  varchar,
  serial,
  bigint,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  description: text('description'),
  bitfield: bigint('bitfield', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
