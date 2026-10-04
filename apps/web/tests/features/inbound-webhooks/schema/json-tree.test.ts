import { describe, expect, it } from 'vitest';

import {
  locatePath,
  objectKindAt,
  parseDocument,
  pathSegments,
} from '@/features/inbound-webhooks/schema/json-tree';

const DOC = `{
  "version": 1,
  "steps": [
    {
      "key": "identity",
      "fields": [
        { "key": "firstname", "type": "string", "required": true, "maxlenght": 5 },
        {
          "key": "team",
          "type": "string",
          "required": true,
          "condition": { "op": "eq", "field": "identity.status", "value": "lead" }
        },
        {
          "key": "members",
          "type": "array",
          "maxItems": 5,
          "item": { "key": "member", "type": "object", "fields": [] }
        },
        {
          "key": "status",
          "type": "enum",
          "options": [{ "value": "lead" }]
        }
      ]
    }
  ]
}`;

const slice = (range: { from: number; to: number } | null) =>
  range ? DOC.slice(range.from, range.to) : null;

describe('pathSegments', () => {
  it.each([
    ['', []],
    ['version', ['version']],
    ['steps[0].fields[1].condition.field', ['steps', 0, 'fields', 1, 'condition', 'field']],
    ['a[2][3].b', ['a', 2, 3, 'b']],
  ])('splits %j', (path, expected) => {
    expect(pathSegments(path)).toEqual(expected);
  });
});

describe('locatePath', () => {
  const state = parseDocument(DOC);

  it('finds a scalar property, key and value together', () => {
    expect(slice(locatePath(state, 'steps[0].fields[0].maxlenght'))).toBe('"maxlenght": 5');
  });

  it('finds a property inside a condition', () => {
    expect(slice(locatePath(state, 'steps[0].fields[1].condition.field'))).toBe(
      '"field": "identity.status"'
    );
  });

  it('marks only the key of a property that holds an object or a list', () => {
    expect(slice(locatePath(state, 'steps[0].fields[1].condition'))).toBe('"condition"');
    expect(slice(locatePath(state, 'steps[0].fields[3].options'))).toBe('"options"');
  });

  it('marks the opening brace of a list element', () => {
    expect(slice(locatePath(state, 'steps[0].fields[1]'))).toBe('{');
    expect(locatePath(state, 'steps[0].fields[1]')?.from).toBe(
      DOC.indexOf('{\n          "key": "team"')
    );
  });

  it('follows the item of an array field', () => {
    expect(slice(locatePath(state, 'steps[0].fields[2].item.type'))).toBe('"type": "object"');
  });

  it('falls back to the nearest thing that exists when the target is missing', () => {
    // `required` is absent on this field, so the error points at the field
    const found = locatePath(state, 'steps[0].fields[2].required');

    expect(found?.from).toBe(DOC.indexOf('{\n          "key": "members"'));
  });

  it('points at the root for an error about the whole schema', () => {
    expect(locatePath(state, '')?.from).toBe(0);
  });

  it('gives up on a document with no object at all', () => {
    expect(locatePath(parseDocument('not json'), 'steps')).toBeNull();
    expect(locatePath(parseDocument(''), 'steps')).toBeNull();
  });
});

describe('objectKindAt', () => {
  const kindAt = (needle: string) => {
    const state = parseDocument(DOC);
    return objectKindAt(state, DOC.indexOf(needle));
  };

  it('knows the root, a step, a field, a condition, an item and an option', () => {
    expect(objectKindAt(parseDocument(DOC), 1)).toBe('schema');
    expect(kindAt('"key": "identity"')).toBe('step');
    expect(kindAt('"key": "firstname"')).toBe('field');
    expect(kindAt('"op": "eq"')).toBe('condition');
    expect(kindAt('"key": "member"')).toBe('field');
    expect(kindAt('"value": "lead" }]')).toBe('option');
  });

  it('is unknown for an object outside the schema format', () => {
    const state = parseDocument('{ "other": { "x": 1 } }');
    expect(objectKindAt(state, 15)).toBeNull();
  });
});
