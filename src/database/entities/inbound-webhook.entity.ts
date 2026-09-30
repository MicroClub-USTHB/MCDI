import {
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.entity';
import type { FormSchema } from '../../modules/inbound-webhooks/schema/form-schema.types';

/**
 * An MCDI-owned HTTP endpoint that ACCEPTS structured submissions from an
 * authenticated project (inbound), validates them against a declared schema,
 * and persists them.
 *
 * Not to be confused with:
 *   - Discord's own webhooks (DiscordService.createWebhook) — MCDI is the client
 *   - projects.webhookUrl — outbound; the project's address for MCDI to call
 */
export const inboundWebhooks = pgTable(
  'inbound_webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    /** A FormSchema, already validated by the Layer-1 schema validator */
    schema: jsonb('schema').$type<FormSchema>().notNull(),
    /** Origin allowlist. Empty = no origin check performed. */
    acceptedOrigins: jsonb('accepted_origins')
      .$type<string[]>()
      .default([])
      .notNull(),
    /**
     * AES-256-GCM ciphertext — NOT a hash. HMAC verification must recompute
     * HMAC(secret, body), which requires the raw secret back.
     */
    signingSecretEnc: text('signing_secret_enc').notNull(),
    requireSignature: boolean('require_signature').default(true).notNull(),
    rejectUnknownFields: boolean('reject_unknown_fields')
      .default(true)
      .notNull(),
    /** Off by default: data access should be explicit, not inherited. */
    allowRoleInheritance: boolean('allow_role_inheritance')
      .default(false)
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    submissionCount: integer('submission_count').default(0).notNull(),
    lastSubmissionAt: timestamp('last_submission_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    projectIdx: index('idx_inbound_webhooks_project').on(t.projectId),
    slugUniq: uniqueIndex('uq_inbound_webhooks_project_slug').on(
      t.projectId,
      t.slug,
    ),
  }),
);

export type InboundWebhook = typeof inboundWebhooks.$inferSelect;
