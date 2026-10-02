import {
  pgTable,
  uuid,
  jsonb,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { inboundWebhooks } from './inbound-webhook.entity';
import { projects } from './project.entity';

export type DraftStatus = 'open' | 'submitted' | 'expired';

/** A partially-filled multi-step submission, accumulated across requests. */
export const inboundWebhookDrafts = pgTable(
  'inbound_webhook_drafts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id')
      .references(() => inboundWebhooks.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
    completedSteps: jsonb('completed_steps')
      .$type<string[]>()
      .default([])
      .notNull(),
    status: varchar('status', { length: 16 })
      .$type<DraftStatus>()
      .default('open')
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    webhookIdx: index('idx_inbound_webhook_drafts_webhook').on(t.webhookId),
    expiryIdx: index('idx_inbound_webhook_drafts_expiry').on(
      t.status,
      t.expiresAt,
    ),
  }),
);

export type InboundWebhookDraft = typeof inboundWebhookDrafts.$inferSelect;
