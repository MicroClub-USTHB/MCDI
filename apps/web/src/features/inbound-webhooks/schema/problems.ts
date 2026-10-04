/**
 * What the editor can tell the admin about a schema, and where.
 *
 * Three sources, each doing what it is best at:
 * - syntax: the document is not valid JSON;
 * - format: instant checks the editor makes itself from the shared catalog
 *   (an unknown property, a required file field that can't work yet);
 * - server: the API's verdict from the preview endpoint, which owns every
 *   other rule and is authoritative.
 */
import { jsonParseLinter } from '@codemirror/lang-json';
import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import {
  INBOUND_BASE_FIELD_PROPERTIES,
  INBOUND_CONDITION_PROPERTIES,
  INBOUND_FIELD_PROPERTIES,
  INBOUND_FIELD_TYPES,
  INBOUND_OPTION_PROPERTIES,
  INBOUND_SCHEMA_PROPERTIES,
  INBOUND_STEP_PROPERTIES,
} from '@mcdi/contracts';
import type { InboundFieldType, InboundSchemaProperty } from '@mcdi/contracts';

import type { SchemaProblemDto } from '@/features/inbound-webhooks/types';
import {
  kindOfObject,
  locatePath,
  propertyName,
  propertyNameNode,
  stringValueOf,
  treeOf,
  findProperty,
  propertyValue,
} from '@/features/inbound-webhooks/schema/json-tree';
import type { NodeKind, SyntaxNode } from '@/features/inbound-webhooks/schema/json-tree';

export interface Problem {
  from: number;
  to: number;
  line: number;
  message: string;
  source: 'syntax' | 'format' | 'server';
  severity: 'error' | 'warning';
  path?: string;
  code?: string;
}

const isFieldType = (value: string | null): value is InboundFieldType =>
  value !== null && (INBOUND_FIELD_TYPES as readonly string[]).includes(value);

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/** The name `typo` was most likely meant to be, ignoring case, or null. */
export function closestName(typo: string, names: string[]): string | null {
  const wanted = typo.toLowerCase();
  const limit = wanted.length >= 8 ? 3 : 2;
  let best: { name: string; score: number } | null = null;
  for (const name of names) {
    const score = distance(wanted, name.toLowerCase());
    if (score <= limit && score < wanted.length && (!best || score < best.score)) {
      best = { name, score };
    }
  }
  return best?.name ?? null;
}

const ALL_FIELD_PROPERTIES: InboundSchemaProperty[] = [
  ...INBOUND_BASE_FIELD_PROPERTIES,
  ...Object.values(INBOUND_FIELD_PROPERTIES).flat(),
];

/** The properties an object of this kind may have; a field of unknown type may have any field's. */
export function allowedProperties(
  kind: NodeKind,
  fieldType: string | null
): InboundSchemaProperty[] {
  switch (kind) {
    case 'schema':
      return INBOUND_SCHEMA_PROPERTIES;
    case 'step':
      return INBOUND_STEP_PROPERTIES;
    case 'option':
      return INBOUND_OPTION_PROPERTIES;
    case 'condition':
      return INBOUND_CONDITION_PROPERTIES;
    case 'field':
      return isFieldType(fieldType)
        ? [...INBOUND_BASE_FIELD_PROPERTIES, ...INBOUND_FIELD_PROPERTIES[fieldType]]
        : ALL_FIELD_PROPERTIES;
  }
}

function describeOwner(kind: NodeKind, fieldType: string | null): string {
  const noun = kind === 'field' ? (isFieldType(fieldType) ? `${fieldType} field` : 'field') : kind;
  if (kind === 'schema') return 'the schema';
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;
}

function objects(state: EditorState): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  treeOf(state).iterate({
    enter: (node) => {
      if (node.name === 'Object') found.push(node.node);
    },
  });
  return found;
}

const lineOf = (state: EditorState, pos: number) => state.doc.lineAt(pos).number;

/** Properties that don't exist on their object, caught as you type. */
export function findUnknownProperties(state: EditorState): Problem[] {
  const problems: Problem[] = [];

  for (const object of objects(state)) {
    const kind = kindOfObject(state, object);
    if (!kind) continue;
    const fieldType = kind === 'field' ? stringValueOf(state, object, 'type') : null;
    const allowed = allowedProperties(kind, fieldType);
    const names = allowed.map((property) => property.name);

    for (const property of object.getChildren('Property')) {
      const name = propertyName(state, property);
      const key = propertyNameNode(property);
      if (name === null || !key || names.includes(name)) continue;

      const suggestion = closestName(name, names);
      problems.push({
        from: key.from,
        to: key.to,
        line: lineOf(state, key.from),
        message:
          `"${name}" is not a property of ${describeOwner(kind, fieldType)}.` +
          (suggestion ? ` Did you mean "${suggestion}"?` : ''),
        source: 'format',
        severity: 'error',
        code: 'UNKNOWN_PROPERTY',
      });
    }
  }
  return problems;
}

/** A required file field can't be satisfied while uploads don't exist (IW-08). */
export function findFileWarnings(state: EditorState): Problem[] {
  const problems: Problem[] = [];

  for (const object of objects(state)) {
    if (kindOfObject(state, object) !== 'field') continue;
    const type = stringValueOf(state, object, 'type');
    if (type !== 'file' && type !== 'files') continue;

    const required = findProperty(state, object, 'required');
    const requiredValue = required ? propertyValue(required) : null;
    if (requiredValue?.name !== 'True') continue;

    const property = findProperty(state, object, 'type');
    if (!property) continue;
    problems.push({
      from: property.from,
      to: property.to,
      line: lineOf(state, property.from),
      message:
        "Submissions can't include files yet, so this required field will reject every submission.",
      source: 'format',
      severity: 'warning',
      code: 'FILE_UPLOAD_UNAVAILABLE',
    });
  }
  return problems;
}

function syntaxProblems(state: EditorState): Problem[] {
  return jsonParseLinter()({ state } as unknown as EditorView).map((diagnostic) => ({
    from: diagnostic.from,
    to: Math.max(diagnostic.to, Math.min(diagnostic.from + 1, state.doc.length)),
    line: lineOf(state, diagnostic.from),
    message: diagnostic.message,
    source: 'syntax' as const,
    severity: 'error' as const,
  }));
}

function serverProblem(state: EditorState, dto: SchemaProblemDto): Problem | null {
  const range = locatePath(state, dto.path);
  if (!range) return null;
  return {
    ...range,
    line: lineOf(state, range.from),
    message: dto.message,
    source: 'server',
    severity: 'error',
    path: dto.path,
    code: dto.code,
  };
}

const overlaps = (a: Problem, b: Problem) => a.from < b.to && b.from < a.to;

/**
 * Everything to show for the current text. While the JSON is broken only the
 * editor's own findings are shown, since the server's answer belongs to an
 * earlier, valid version of the text and would point at the wrong places.
 */
export function collectProblems(state: EditorState, server: SchemaProblemDto[]): Problem[] {
  const syntax = syntaxProblems(state);
  const format = [...findUnknownProperties(state), ...findFileWarnings(state)];

  const fromServer = syntax.length
    ? []
    : server
        .map((dto) => serverProblem(state, dto))
        .filter((problem): problem is Problem => problem !== null)
        // The editor already flagged this one, instantly.
        .filter(
          (problem) =>
            !(
              problem.code === 'UNKNOWN_PROPERTY' &&
              format.some((own) => own.code === 'UNKNOWN_PROPERTY' && overlaps(own, problem))
            )
        );

  return [...syntax, ...format, ...fromServer].sort((a, b) => a.from - b.from);
}
