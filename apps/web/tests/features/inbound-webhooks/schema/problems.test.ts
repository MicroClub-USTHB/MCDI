import { describe, expect, it } from 'vitest';

import { parseDocument } from '@/features/inbound-webhooks/schema/json-tree';
import {
  closestName,
  collectProblems,
  findFileWarnings,
  findUnknownProperties,
} from '@/features/inbound-webhooks/schema/problems';

const form = (fields: string) =>
  `{ "version": 1, "steps": [ { "key": "s", "fields": [ ${fields} ] } ] }`;

const unknown = (doc: string) => findUnknownProperties(parseDocument(doc));

describe('closestName', () => {
  const names = ['maxLength', 'minLength', 'pattern', 'trim'];

  it('suggests the name a typo was meant to be, ignoring case', () => {
    expect(closestName('maxlenght', names)).toBe('maxLength');
    expect(closestName('patern', names)).toBe('pattern');
    expect(closestName('MAXLENGTH', names)).toBe('maxLength');
  });

  it('suggests nothing when nothing is close', () => {
    expect(closestName('colour', names)).toBeNull();
    expect(closestName('x', names)).toBeNull();
  });
});

describe('findUnknownProperties', () => {
  it('flags a misspelt property of a field, with a suggestion', () => {
    const doc = form('{ "key": "a", "type": "string", "required": true, "maxlenght": 5 }');

    const [problem] = unknown(doc);

    expect(problem?.message).toBe(
      '"maxlenght" is not a property of a string field. Did you mean "maxLength"?'
    );
    expect(doc.slice(problem!.from, problem!.to)).toBe('"maxlenght"');
    expect(problem?.source).toBe('format');
    expect(problem?.line).toBe(1);
  });

  it('flags a property the field type does not have, without a suggestion', () => {
    const [problem] = unknown(
      form('{ "key": "a", "type": "boolean", "required": true, "minLength": 5 }')
    );

    expect(problem?.message).toBe('"minLength" is not a property of a boolean field.');
  });

  it('accepts every property a field type has', () => {
    expect(
      unknown(
        form(
          '{ "key": "a", "type": "string", "required": true, "label": "A", "description": "d", "default": "x", "minLength": 1, "maxLength": 9, "pattern": "^a", "trim": true }'
        )
      )
    ).toEqual([]);
  });

  it('does not guess when the type is missing or unknown', () => {
    expect(unknown(form('{ "key": "a", "required": true, "maxLength": 5 }'))).toEqual([]);
    expect(unknown(form('{ "key": "a", "type": "strng", "maxLength": 5 }'))).toEqual([]);
    const [problem] = unknown(form('{ "key": "a", "required": true, "bogus": 1 }'));
    expect(problem?.message).toBe('"bogus" is not a property of a field.');
  });

  it('checks the root, steps, conditions and options too', () => {
    const doc = `{
  "version": 1, "stepz": [],
  "steps": [ { "key": "s", "titel": "x", "fields": [
    { "key": "a", "type": "enum", "required": true, "options": [ { "value": "v", "lable": "L" } ],
      "condition": { "op": "eq", "feild": "s.a", "value": 1 } }
  ] } ]
}`;

    expect(unknown(doc).map((p) => p.message.split(' is not')[0])).toEqual([
      '"stepz"',
      '"titel"',
      '"lable"',
      '"feild"',
    ]);
  });

  it('reads nested conditions and array items', () => {
    const doc = form(
      '{ "key": "a", "type": "array", "required": true, "maxItems": 2, "item": { "key": "i", "type": "object", "required": true, "fields": [ { "key": "x", "type": "string", "required": true, "oops": 1, "condition": { "op": "not", "of": { "op": "eq", "field": "./y", "valeu": 1 } } } ] } }'
    );

    expect(unknown(doc).map((p) => p.message.split(' is not')[0])).toEqual(['"oops"', '"valeu"']);
  });

  it('leaves free-form values alone', () => {
    expect(
      unknown(
        form(
          '{ "key": "a", "type": "json", "required": true, "maxBytes": 10, "default": { "anything": { "goes": 1 } } }'
        )
      )
    ).toEqual([]);
  });

  it('copes with a document that is not finished', () => {
    expect(() => unknown('{ "steps": [ { "key": "s", "fields": [ { "key": ')).not.toThrow();
    expect(unknown('')).toEqual([]);
  });
});

describe('findFileWarnings', () => {
  const warn = (doc: string) => findFileWarnings(parseDocument(doc));

  it('warns about a required file field, since uploads are not available yet', () => {
    const doc = form(
      '{ "key": "cv", "type": "file", "required": true, "accept": ["application/pdf"], "maxSizeBytes": 100 }'
    );

    const [problem] = warn(doc);

    expect(problem?.severity).toBe('warning');
    expect(problem?.message).toMatch(/can't include files yet/);
    expect(doc.slice(problem!.from, problem!.to)).toBe('"type": "file"');
  });

  it('warns about a required files field too', () => {
    expect(
      warn(
        form(
          '{ "key": "cv", "type": "files", "required": true, "accept": ["a/b"], "maxSizeBytes": 1, "maxCount": 2 }'
        )
      )
    ).toHaveLength(1);
  });

  it('says nothing about an optional file field or other types', () => {
    expect(
      warn(
        form(
          '{ "key": "cv", "type": "file", "required": false, "accept": ["a/b"], "maxSizeBytes": 1 }, { "key": "n", "type": "string", "required": true }'
        )
      )
    ).toEqual([]);
  });
});

describe('collectProblems', () => {
  const GOOD = form('{ "key": "a", "type": "string", "required": true }');
  const server = [
    {
      path: 'steps[0].fields[0].maxlenght',
      code: 'UNKNOWN_PROPERTY',
      message: '"maxlenght" is not a property of a string field.',
    },
    {
      path: 'steps[0].fields[0].condition.field',
      code: 'FORWARD_REFERENCE',
      message: 'Condition references "s.nope", which is not declared earlier.',
    },
  ];

  it('reports a syntax error and nothing from the server while the JSON is broken', () => {
    const problems = collectProblems(parseDocument('{ "version": 1, '), server);

    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((p) => p.source === 'syntax' || p.source === 'format')).toBe(true);
  });

  it("places the server's problems at their path, with line numbers", () => {
    const doc = `{
  "version": 1,
  "steps": [
    { "key": "s", "fields": [
      { "key": "a", "type": "string", "required": true, "maxlenght": 5,
        "condition": { "op": "eq", "field": "s.nope", "value": 1 } }
    ] }
  ]
}`;

    const problems = collectProblems(parseDocument(doc), server);

    const conditionProblem = problems.find((p) => p.code === 'FORWARD_REFERENCE');
    expect(conditionProblem).toMatchObject({
      source: 'server',
      path: 'steps[0].fields[0].condition.field',
      line: 6,
    });
    expect(doc.slice(conditionProblem!.from, conditionProblem!.to)).toBe('"field": "s.nope"');
  });

  it('shows an unknown property once when both the editor and the server find it', () => {
    const doc = form('{ "key": "a", "type": "string", "required": true, "maxlenght": 5 }');

    const problems = collectProblems(parseDocument(doc), [server[0]!]);

    expect(problems.filter((p) => p.message.includes('maxlenght'))).toHaveLength(1);
    expect(problems[0]?.source).toBe('format');
  });

  it('lists the problems in the order they appear', () => {
    const doc = form(
      '{ "key": "a", "type": "string", "required": true, "zzz": 1, "condition": { "op": "eq", "field": "x", "value": 1 } }'
    );

    const problems = collectProblems(parseDocument(doc), [
      { path: 'steps[0].fields[0].condition.field', code: 'X', message: 'later' },
    ]);

    const starts = problems.map((p) => p.from);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('has nothing to report for a good schema', () => {
    expect(collectProblems(parseDocument(GOOD), [])).toEqual([]);
  });
});
