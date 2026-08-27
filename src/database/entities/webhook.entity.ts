import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import { servers } from './server.entity';

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    discordWebhookId: varchar('discord_webhook_id', { length: 255 })
      .notNull()
      .unique(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    serverId: varchar('server_id', { length: 255 })
      .references(() => servers.id, { onDelete: 'cascade' })
      .notNull(),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    // Discord avatar hash, not the uploaded image
    avatar: text('avatar'),
    // AES-256-GCM payload; the plaintext token is never stored
    encryptedToken: text('encrypted_token').notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    projectIdIdx: index('webhooks_project_id_idx').on(t.projectId),
    serverIdIdx: index('webhooks_server_id_idx').on(t.serverId),
    channelIdIdx: index('webhooks_channel_id_idx').on(t.channelId),
  }),
);
