import {
  pgTable,
  uuid,
  jsonb,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { inboundWebhooks } from './inbound-webhook.entity';
import { inboundWebhookDrafts } from './inbound-webhook-draft.entity';
import { projects } from './project.entity';

export const inboundWebhookSubmissions = pgTable(
  'inbound_webhook_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id')
      .references(() => inboundWebhooks.id, { onDelete: 'cascade' })
      .notNull(),
    /**
     * Denormalized from the webhook so submission queries can be scoped by
     * project without a join — the same trade-off project_servers makes.
     */
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    draftId: uuid('draft_id').references(() => inboundWebhookDrafts.id, {
      onDelete: 'set null',
    }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    origin: text('origin'),
    userAgent: text('user_agent'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    webhookIdx: index('idx_inbound_webhook_submissions_webhook').on(
      t.webhookId,
      t.receivedAt,
    ),
    projectIdx: index('idx_inbound_webhook_submissions_project').on(
      t.projectId,
    ),
  }),
);

export type InboundWebhookSubmission =
  typeof inboundWebhookSubmissions.$inferSelect;
