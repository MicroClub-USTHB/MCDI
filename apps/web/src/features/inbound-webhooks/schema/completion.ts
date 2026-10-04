/**
 * Autocomplete for the schema editor: property names for the kind of object
 * the cursor is in, field types after `"type":` and operators after `"op":`,
 * each with a one-line description, all from the shared catalog.
 */
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import {
  INBOUND_CONDITION_OPERATORS,
  INBOUND_FIELD_TYPES,
  INBOUND_FIELD_TYPE_DESCRIPTIONS,
} from '@mcdi/contracts';

import {
  kindOfObject,
  objectAt,
  propertyName,
  propertyNames,
  stringValueOf,
  treeOf,
} from '@/features/inbound-webhooks/schema/json-tree';
import type { NodeKind, SyntaxNode } from '@/features/inbound-webhooks/schema/json-tree';
import { allowedProperties } from '@/features/inbound-webhooks/schema/problems';

/** Options whose name starts with what was typed, case-insensitively. */
function matching<T extends { label: string }>(options: T[], typed: string): T[] {
  const wanted = typed.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().startsWith(wanted));
}

function unique<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.name) && seen.add(item.name));
}

/** `steps` and `fields` are alternatives: once one is written the other is not offered. */
function withAlternatives(kind: NodeKind, present: Set<string>): Set<string> {
  if (kind !== 'schema') return present;
  const taken = new Set(present);
  if (present.has('steps')) taken.add('fields');
  if (present.has('fields')) taken.add('steps');
  return taken;
}

function propertyOptions(
  kind: NodeKind,
  fieldType: string | null,
  present: Set<string>,
  apply: (name: string) => string
): Completion[] {
  const taken = withAlternatives(kind, present);
  return unique(allowedProperties(kind, fieldType))
    .filter((property) => !taken.has(property.name))
    .map((property) => ({
      label: property.name,
      detail: property.description,
      type: 'property',
      apply: apply(property.name),
    }));
}

export function schemaCompletions(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context;
  const node = treeOf(state).resolveInner(pos, -1);

  // Inside a quoted string: either a property name or a value.
  if (node.name === 'PropertyName' || node.name === 'String') {
    const typed = state.sliceDoc(node.from + 1, pos);
    const range = { from: node.from, to: node.to };
    const parent = node.parent;

    const isKey =
      node.name === 'PropertyName' || (node.name === 'String' && parent?.name === 'Object');
    if (isKey) {
      const object = parent?.name === 'Property' ? parent.parent : parent;
      const kind = object ? kindOfObject(state, object) : null;
      if (!object || !kind) return null;

      const own = parent?.name === 'Property' ? propertyName(state, parent) : null;
      const present = new Set(propertyNames(state, object));
      if (own) present.delete(own);
      const fieldType = kind === 'field' ? stringValueOf(state, object, 'type') : null;

      const options = matching(
        propertyOptions(kind, fieldType, present, (name) => `"${name}"`),
        typed
      );
      return options.length ? { ...range, options, filter: false } : null;
    }

    // A value: only `"type"` of a field and `"op"` of a condition have a fixed set.
    if (parent?.name === 'Property') {
      const object = parent.parent;
      const kind = object ? kindOfObject(state, object) : null;
      const name = propertyName(state, parent);

      let candidates: Completion[] | null = null;
      if (name === 'type' && kind === 'field') {
        candidates = INBOUND_FIELD_TYPES.map((type) => ({
          label: type,
          detail: INBOUND_FIELD_TYPE_DESCRIPTIONS[type],
          type: 'enum',
          apply: `"${type}"`,
        }));
      } else if (name === 'op' && kind === 'condition') {
        candidates = INBOUND_CONDITION_OPERATORS.map((operator) => ({
          label: operator.name,
          detail: operator.description,
          type: 'enum',
          apply: `"${operator.name}"`,
        }));
      }
      if (!candidates) return null;
      const options = matching(candidates, typed);
      return options.length ? { ...range, options, filter: false } : null;
    }
    return null;
  }

  // Between properties: on request, or once a letter has been typed.
  const word = context.matchBefore(/\w*$/);
  if (!context.explicit && (!word || word.from === word.to)) return null;

  const object: SyntaxNode | null =
    node.name === 'Object' ? node : node.parent?.name === 'Object' ? node.parent : null;
  if (!object || object !== objectAt(state, pos)) return null;
  const kind = kindOfObject(state, object);
  if (!kind) return null;

  const fieldType = kind === 'field' ? stringValueOf(state, object, 'type') : null;
  const options = matching(
    propertyOptions(
      kind,
      fieldType,
      new Set(propertyNames(state, object)),
      (name) => `"${name}": `
    ),
    word?.text ?? ''
  );
  return options.length ? { from: word?.from ?? pos, options, filter: false } : null;
}
