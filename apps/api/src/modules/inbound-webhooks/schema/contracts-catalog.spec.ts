import {
  INBOUND_BASE_FIELD_PROPERTIES,
  INBOUND_CONDITION_OPERATORS,
  INBOUND_FIELD_PROPERTIES,
  INBOUND_FIELD_TYPES,
  INBOUND_WEBHOOK_TEMPLATES,
} from '@mcdi/contracts';
import { buildExamplePayload } from '../docs/webhook-docs.generator';
import { FIELD_TYPES } from './form-schema.types';
import type { FormSchema } from './form-schema.types';
import { validatePayload } from './payload.validator';
import {
  CONDITION_OPERATOR_NAMES,
  baseFieldPropertyNames,
  fieldPropertyNames,
  validateSchema,
} from './schema.validator';

/**
 * The admin schema editor suggests and checks names from `@mcdi/contracts`.
 * These tests keep that catalog and the templates in step with the validator
 * the API really enforces, so neither can drift without a failing test.
 */
describe('@mcdi/contracts inbound webhook catalog', () => {
  it('lists exactly the field types the API supports', () => {
    expect([...INBOUND_FIELD_TYPES].sort()).toEqual([...FIELD_TYPES].sort());
  });

  it('lists exactly the properties every field may carry', () => {
    expect(INBOUND_BASE_FIELD_PROPERTIES.map((p) => p.name).sort()).toEqual(
      baseFieldPropertyNames().sort(),
    );
  });

  it.each([...FIELD_TYPES])(
    'lists exactly the properties of a %s field',
    (type) => {
      expect(INBOUND_FIELD_PROPERTIES[type].map((p) => p.name).sort()).toEqual(
        fieldPropertyNames(type).sort(),
      );
    },
  );

  it('lists exactly the condition operators the API supports', () => {
    const names = INBOUND_CONDITION_OPERATORS.map((o) => o.name);
    expect(names.sort()).toEqual(
      [...CONDITION_OPERATOR_NAMES, 'and', 'or', 'not'].sort(),
    );
  });

  it('describes every type and property for the editor hints', () => {
    for (const type of INBOUND_FIELD_TYPES) {
      for (const property of INBOUND_FIELD_PROPERTIES[type]) {
        expect(property.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('@mcdi/contracts starter templates', () => {
  it('offers the four starting points', () => {
    expect(INBOUND_WEBHOOK_TEMPLATES.map((t) => t.id)).toEqual([
      'recruitment',
      'workshop',
      'event',
      'blank',
    ]);
  });

  it.each(INBOUND_WEBHOOK_TEMPLATES.map((t) => [t.id, t] as const))(
    'the %s template is a schema the API accepts',
    (_id, template) => {
      const result = validateSchema(template.schema);

      expect(result.ok ? [] : result.errors).toEqual([]);
    },
  );

  it.each(INBOUND_WEBHOOK_TEMPLATES.map((t) => [t.id, t] as const))(
    'the %s template produces an example payload that passes it',
    (_id, template) => {
      const schema = template.schema as unknown as FormSchema;

      const check = validatePayload(schema, buildExamplePayload(schema), {
        rejectUnknownFields: true,
      });

      expect(check.ok ? [] : check.errors).toEqual([]);
    },
  );

  it('gives every template a name and a description', () => {
    for (const template of INBOUND_WEBHOOK_TEMPLATES) {
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
    }
  });
});
