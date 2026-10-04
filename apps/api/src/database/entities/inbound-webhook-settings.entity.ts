import {
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Settings shared by every inbound webhook. Exactly one row exists (`id = 1`).
 *
 * `defaultReaderRoleIds` are the Discord roles a new webhook gets as readers
 * when its creator names none. `NULL` means "not configured": fall back to the
 * environment default (the executive role). An empty array is a deliberate
 * "no defaults". It is a plain list, not a reference: a role deleted later is
 * skipped when it is applied.
 */
export const inboundWebhookSettings = pgTable(
  'inbound_webhook_settings',
  {
    id: integer('id').primaryKey().default(1),
    defaultReaderRoleIds: jsonb('default_reader_role_ids').$type<string[]>(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Discord member id of the admin who last changed it; no FK so the row
    // survives a member being pruned.
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (t) => [check('inbound_webhook_settings_single_row', sql`${t.id} = 1`)],
);

export type InboundWebhookSettingsRow =
  typeof inboundWebhookSettings.$inferSelect;
