import { pgTable, integer, primaryKey, varchar } from 'drizzle-orm/pg-core';
import { roleInheritanceRules } from './role-inheritance-rule.entity';
import { servers } from './server.entity';

export const roleInheritanceRuleTargets = pgTable(
  'role_inheritance_rule_targets',
  {
    ruleId: integer('rule_id')
      .references(() => roleInheritanceRules.id)
      .notNull(),
    targetServerId: varchar('target_server_id', { length: 255 })
      .references(() => servers.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ruleId, t.targetServerId] }),
  }),
);
