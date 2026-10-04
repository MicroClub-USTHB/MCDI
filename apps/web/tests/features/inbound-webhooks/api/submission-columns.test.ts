import { describe, expect, it } from 'vitest';

import {
  cellText,
  defaultColumnPaths,
  schemaColumns,
  valueAtPath,
} from '@/features/inbound-webhooks/api/submission-columns';

const STEPPED = {
  version: 1,
  steps: [
    {
      key: 'identity',
      fields: [
        { key: 'firstname', type: 'string' },
        { key: 'email', type: 'email' },
        {
          key: 'address',
          type: 'object',
          fields: [
            { key: 'city', type: 'string' },
            { key: 'geo', type: 'object', fields: [{ key: 'lat', type: 'number' }] },
          ],
        },
      ],
    },
    {
      key: 'extras',
      fields: [
        { key: 'tags', type: 'array', item: { key: 'tag', type: 'string' } },
        { key: 'cv', type: 'file' },
        { key: 'notes', type: 'json' },
      ],
    },
  ],
};

const FLAT = {
  version: 1,
  fields: [
    { key: 'title', type: 'string' },
    { key: 'place', type: 'object', fields: [{ key: 'city', type: 'string' }] },
    { key: 'tags', type: 'array', item: { key: 'tag', type: 'string' } },
  ],
};

describe('schemaColumns', () => {
  it('names a stepped field by step and field', () => {
    expect(schemaColumns(STEPPED).map((c) => c.path)).toEqual([
      'identity.firstname',
      'identity.email',
      'identity.address.city',
      'identity.address.geo.lat',
      'extras.tags',
      'extras.cv',
      'extras.notes',
    ]);
  });

  it('names a flat field by its own key, with no step in front', () => {
    expect(schemaColumns(FLAT).map((c) => c.path)).toEqual(['title', 'place.city', 'tags']);
  });

  it('keeps a list, a file and a json value in one column', () => {
    const paths = schemaColumns(STEPPED).map((c) => c.path);

    expect(paths).toContain('extras.tags');
    expect(paths).not.toContain('extras.tags.tag');
  });

  it('copes with a schema that is not shaped as expected', () => {
    expect(schemaColumns({})).toEqual([]);
    expect(schemaColumns({ steps: 'nope' })).toEqual([]);
    expect(schemaColumns({ steps: [null, { key: 's', fields: [{ type: 'string' }] }] })).toEqual(
      []
    );
  });
});

describe('defaultColumnPaths', () => {
  it('takes the first three answers in schema order', () => {
    expect(defaultColumnPaths(STEPPED)).toEqual([
      'identity.firstname',
      'identity.email',
      'identity.address.city',
    ]);
  });

  it('takes fewer when the schema has fewer', () => {
    expect(defaultColumnPaths({ version: 1, fields: [{ key: 'a', type: 'string' }] })).toEqual([
      'a',
    ]);
  });
});

describe('valueAtPath', () => {
  const payload = { identity: { address: { city: 'Algiers' } }, title: 'Hello', tags: ['a'] };

  it('reads nested and top-level values', () => {
    expect(valueAtPath(payload, 'identity.address.city')).toBe('Algiers');
    expect(valueAtPath(payload, 'title')).toBe('Hello');
    expect(valueAtPath(payload, 'tags')).toEqual(['a']);
  });

  it('is undefined for anything missing, including through a non-object', () => {
    expect(valueAtPath(payload, 'identity.nope.city')).toBeUndefined();
    expect(valueAtPath(payload, 'title.length')).toBeUndefined();
    expect(valueAtPath(null, 'a')).toBeUndefined();
  });
});

describe('cellText', () => {
  it('shows scalars as they are and empty for nothing', () => {
    expect(cellText('hi')).toBe('hi');
    expect(cellText(7)).toBe('7');
    expect(cellText(false)).toBe('false');
    expect(cellText(undefined)).toBe('');
    expect(cellText(null)).toBe('');
  });

  it('writes a list or an object as JSON', () => {
    expect(cellText(['a', 'b'])).toBe('["a","b"]');
    expect(cellText({ a: 1 })).toBe('{"a":1}');
  });

  it('cuts a long value short with an ellipsis', () => {
    const text = cellText('x'.repeat(200), 10);

    expect(text).toBe(`${'x'.repeat(10)}…`);
  });
});
