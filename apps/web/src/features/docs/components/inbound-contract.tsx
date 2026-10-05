import {
  INBOUND_BASE_FIELD_PROPERTIES,
  INBOUND_CONDITION_OPERATORS,
  INBOUND_CONDITION_PROPERTIES,
  INBOUND_FIELD_PROPERTIES,
  INBOUND_FIELD_TYPES,
  INBOUND_FIELD_TYPE_DESCRIPTIONS,
  INBOUND_OPTION_PROPERTIES,
  INBOUND_SCHEMA_PROPERTIES,
  INBOUND_STEP_PROPERTIES,
  INBOUND_WEBHOOK_TEMPLATES,
} from '@mcdi/contracts';
import type { InboundSchemaProperty } from '@mcdi/contracts';

import { DocTable } from '@/features/docs/components/doc-table';

interface Table {
  head: string[];
  rows: string[][];
}

const CODE = 'rounded-sm bg-surface-active px-1.5 py-0.5 font-mono text-code text-text-primary';

const properties = (list: InboundSchemaProperty[]): Table => ({
  head: ['Property', 'Meaning'],
  rows: list.map((p) => [p.name, p.description]),
});

const TABLES = {
  'field-types': {
    head: ['Type', 'What it holds'],
    rows: INBOUND_FIELD_TYPES.map((type) => [type, INBOUND_FIELD_TYPE_DESCRIPTIONS[type]]),
  },
  'base-properties': properties(INBOUND_BASE_FIELD_PROPERTIES),
  'field-properties': {
    head: ['Type', 'Property', 'Meaning'],
    rows: INBOUND_FIELD_TYPES.flatMap((type) =>
      INBOUND_FIELD_PROPERTIES[type].map((p) => [type, p.name, p.description])
    ),
  },
  'schema-properties': properties(INBOUND_SCHEMA_PROPERTIES),
  'step-properties': properties(INBOUND_STEP_PROPERTIES),
  'option-properties': properties(INBOUND_OPTION_PROPERTIES),
  'condition-operators': {
    head: ['Operator', 'Holds when the field'],
    rows: INBOUND_CONDITION_OPERATORS.map((op) => [op.name, op.description]),
  },
  'condition-properties': properties(INBOUND_CONDITION_PROPERTIES),
  templates: {
    head: ['Template', 'Name', 'What it is'],
    rows: INBOUND_WEBHOOK_TEMPLATES.map((t) => [t.id, t.label, t.description]),
  },
} satisfies Record<string, Table>;

export type InboundContractName = keyof typeof TABLES;

/**
 * A table of what an inbound webhook schema may contain, read from `@mcdi/contracts` so the
 * docs cannot drift from the catalog the admin editor and the API tests rely on.
 */
export function InboundContract({ name }: { name: InboundContractName }) {
  const table: Table | undefined = TABLES[name];
  if (!table) throw new Error(`InboundContract: unknown table "${name}"`);

  return (
    <DocTable>
      <thead>
        <tr>
          {table.head.map((cell) => (
            <th key={cell}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.join('|')}>
            {row.map((cell, index) => (
              <td key={index}>
                {index < (name === 'field-properties' ? 2 : 1) ? (
                  <code className={CODE}>{cell}</code>
                ) : (
                  cell
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </DocTable>
  );
}
