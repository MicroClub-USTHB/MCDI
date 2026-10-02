import {
  pgTable,
  varchar,
  uuid,
  primaryKey,
  index,
  timestamp,
} from 'drizzle-orm/pg-core';
import { inboundWebhooks } from './inbound-webhook.entity';
import { roles } from './role.entity';

/**
 * Discord roles permitted to READ this webhook's submissions.
 *
 * NOTE: the empty-set semantics are INVERTED relative to project_roles.
 * In project_roles, no entries means "any authenticated user can access".
 * Here, no entries means NOBODY (fail-closed), because submissions carry
 * user-supplied PII. At least one role is required at creation and the set
 * can never be emptied — removing the last role is a deletion of the
 * webhook, not an edit of it.
 */
export const inboundWebhookRoles = pgTable(
  'inbound_webhook_roles',
  {
    webhookId: uuid('webhook_id')
      .references(() => inboundWebhooks.id, { onDelete: 'cascade' })
      .notNull(),
    roleId: varchar('role_id', { length: 255 })
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    grantedBy: varchar('granted_by', { length: 255 }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.webhookId, t.roleId] }),
    roleIdx: index('idx_inbound_webhook_roles_role').on(t.roleId),
  }),
);

export type InboundWebhookRole = typeof inboundWebhookRoles.$inferSelect;
