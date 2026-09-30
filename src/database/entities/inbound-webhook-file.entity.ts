import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { inboundWebhooks } from './inbound-webhook.entity';
import { inboundWebhookDrafts } from './inbound-webhook-draft.entity';
import { inboundWebhookSubmissions } from './inbound-webhook-submission.entity';

export type FileStatus = 'pending' | 'committed' | 'orphaned';

/**
 * Uploaded via the two-phase flow: files never travel inside the submission
 * request, because HMAC verification must buffer the raw body before the
 * request is authenticated.
 */
export const inboundWebhookFiles = pgTable(
  'inbound_webhook_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id')
      .references(() => inboundWebhooks.id, { onDelete: 'cascade' })
      .notNull(),
    draftId: uuid('draft_id').references(() => inboundWebhookDrafts.id, {
      onDelete: 'set null',
    }),
    submissionId: uuid('submission_id').references(
      () => inboundWebhookSubmissions.id,
      { onDelete: 'cascade' },
    ),
    storageKey: text('storage_key').notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    /** Sniffed from magic bytes, never taken from the client's Content-Type */
    mime: varchar('mime', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 512 }),
    status: varchar('status', { length: 16 })
      .$type<FileStatus>()
      .default('pending')
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    webhookIdx: index('idx_inbound_webhook_files_webhook').on(t.webhookId),
    submissionIdx: index('idx_inbound_webhook_files_submission').on(
      t.submissionId,
    ),
    sweepIdx: index('idx_inbound_webhook_files_sweep').on(
      t.status,
      t.expiresAt,
    ),
  }),
);

export type InboundWebhookFile = typeof inboundWebhookFiles.$inferSelect;
