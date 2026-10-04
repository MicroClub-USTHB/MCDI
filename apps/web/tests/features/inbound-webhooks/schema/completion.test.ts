import { CompletionContext } from '@codemirror/autocomplete';
import type { Completion, CompletionResult } from '@codemirror/autocomplete';
import { describe, expect, it } from 'vitest';

import { schemaCompletions } from '@/features/inbound-webhooks/schema/completion';
import { parseDocument } from '@/features/inbound-webhooks/schema/json-tree';

/** `|` marks the cursor. */
function complete(text: string, explicit = false) {
  const pos = text.indexOf('|');
  const doc = text.replace('|', '');
  const state = parseDocument(doc);
  const result = schemaCompletions(
    new CompletionContext(state, pos, explicit)
  ) as CompletionResult | null;
  return { doc, result };
}

const labels = (result: CompletionResult | null) =>
  (result?.options ?? []).map((option: Completion) => option.label);

const inField = (body: string) => `{ "steps": [ { "key": "s", "fields": [ { ${body} } ] } ] }`;

describe('property names', () => {
  it('suggests the properties of the field type being written', () => {
    const { result } = complete(inField('"key": "a", "type": "string", "m|"'));

    expect(labels(result)).toEqual(['minLength', 'maxLength']);
  });

  it('describes each suggestion in one line', () => {
    const { result } = complete(inField('"key": "a", "type": "string", "maxL|"'));

    expect(result?.options[0]).toMatchObject({
      label: 'maxLength',
      detail: 'most characters allowed',
      type: 'property',
    });
  });

  it('replaces the whole quoted name', () => {
    const { doc, result } = complete(inField('"key": "a", "type": "string", "maxL|"'));

    expect(result?.options[0]?.apply).toBe('"maxLength"');
    expect(doc.slice(result!.from, result!.to)).toBe('"maxL"');
  });

  it('does not offer a property that is already there', () => {
    const { result } = complete(inField('"key": "a", "type": "string", "maxLength": 5, "m|"'));

    expect(labels(result)).toEqual(['minLength']);
  });

  it('offers nothing a field of that type cannot have', () => {
    const { result } = complete(inField('"key": "a", "type": "boolean", "m|"'));

    expect(result).toBeNull();
  });

  it('offers the base properties for every type', () => {
    const { result } = complete(inField('"key": "a", "type": "boolean", "re|"'));

    expect(labels(result)).toEqual(['required']);
  });

  it('offers every field property while the type is not set yet', () => {
    const { result } = complete(inField('"key": "a", "max|"'));

    expect(labels(result)).toEqual(
      expect.arrayContaining(['maxLength', 'max', 'maxItems', 'maxSelected', 'maxBytes'])
    );
  });

  it('knows the properties of a step, a condition and an option', () => {
    expect(labels(complete('{ "steps": [ { "key": "s", "ti|" } ] }').result)).toEqual(['title']);
    expect(
      labels(
        complete(inField('"key": "a", "type": "string", "condition": { "op": "eq", "fi|" }')).result
      )
    ).toEqual(['field']);
    expect(
      labels(
        complete(inField('"key": "a", "type": "enum", "options": [ { "value": "x", "la|" } ]'))
          .result
      )
    ).toEqual(['label']);
  });

  it('offers the root properties at the top level', () => {
    expect(labels(complete('{ "ver|" }').result)).toEqual(['version']);
  });

  it('stays quiet inside free-form values', () => {
    const { result } = complete(inField('"key": "a", "type": "json", "default": { "ma|" }'));

    expect(result).toBeNull();
  });

  it('offers the missing properties, with their colon, on an empty line when asked', () => {
    const { result } = complete(inField('"key": "a", "type": "boolean", |'), true);

    expect(labels(result)).toEqual(['required', 'label', 'description', 'condition', 'default']);
    expect(result?.options[0]?.apply).toBe('"required": ');
  });
});

describe('values', () => {
  it('offers the field types after "type":', () => {
    const { result } = complete(inField('"key": "a", "type": "|"'));

    expect(labels(result)).toHaveLength(16);
    expect(result?.options.find((o: Completion) => o.label === 'email')).toMatchObject({
      detail: 'a validated address, optionally limited to some domains',
    });
  });

  it('narrows the types as you type and replaces the quoted value', () => {
    const { doc, result } = complete(inField('"key": "a", "type": "em|"'));

    expect(labels(result)).toEqual(['email']);
    expect(result?.options[0]?.apply).toBe('"email"');
    expect(doc.slice(result!.from, result!.to)).toBe('"em"');
  });

  it('offers the condition operators after "op":', () => {
    const { result } = complete(
      inField('"key": "a", "type": "string", "condition": { "op": "e|" }')
    );

    expect(labels(result)).toEqual(['eq', 'exists']);
  });

  it('offers all operators, with the combinators, for an empty value', () => {
    const { result } = complete(
      inField('"key": "a", "type": "string", "condition": { "op": "|" }')
    );

    expect(labels(result)).toEqual(
      expect.arrayContaining(['eq', 'ne', 'in', 'exists', 'and', 'or', 'not'])
    );
  });

  it('does not suggest types for a "type" key that is not a field’s', () => {
    const { result } = complete('{ "other": { "type": "|" } }');

    expect(result).toBeNull();
  });
});
