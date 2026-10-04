/**
 * Reads the form schema out of CodeMirror's JSON syntax tree, so the editor
 * can say where a path lives and what kind of object the cursor is in.
 *
 * The tree tolerates broken JSON, which is the usual state while typing.
 */
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

type Tree = ReturnType<typeof syntaxTree>;
export type SyntaxNode = Tree['topNode'];

/** What a JSON object in the schema is, which decides the properties it may have. */
export type NodeKind = 'schema' | 'step' | 'field' | 'option' | 'condition';

export interface TextRange {
  from: number;
  to: number;
}

export function parseDocument(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [json()] });
}

export function treeOf(state: EditorState): Tree {
  return ensureSyntaxTree(state, state.doc.length, 5000) ?? syntaxTree(state);
}

/** `steps[0].fields[1].condition` → `['steps', 0, 'fields', 1, 'condition']` */
export function pathSegments(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  for (const match of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    segments.push(match[2] !== undefined ? Number(match[2]) : (match[1] as string));
  }
  return segments;
}

function unquote(text: string): string {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'string') return value;
  } catch {
    // An unfinished string while typing: take what is there.
  }
  return text.replace(/^"/, '').replace(/"$/, '');
}

export function propertyNameNode(property: SyntaxNode): SyntaxNode | null {
  return property.getChild('PropertyName');
}

export function propertyName(state: EditorState, property: SyntaxNode): string | null {
  const name = propertyNameNode(property);
  return name ? unquote(state.sliceDoc(name.from, name.to)) : null;
}

/** The value node of a `"name": value` property, if one has been written. */
export function propertyValue(property: SyntaxNode): SyntaxNode | null {
  for (let child = property.firstChild; child; child = child.nextSibling) {
    if (child.name === ':') return child.nextSibling;
  }
  return null;
}

export function findProperty(
  state: EditorState,
  object: SyntaxNode,
  name: string
): SyntaxNode | null {
  for (const property of object.getChildren('Property')) {
    if (propertyName(state, property) === name) return property;
  }
  return null;
}

export function propertyNames(state: EditorState, object: SyntaxNode): string[] {
  return object
    .getChildren('Property')
    .map((property) => propertyName(state, property))
    .filter((name): name is string => name !== null);
}

/** The string a property holds, or null when absent or not a string. */
export function stringValueOf(state: EditorState, object: SyntaxNode, name: string): string | null {
  const property = findProperty(state, object, name);
  const value = property ? propertyValue(property) : null;
  return value?.name === 'String' ? unquote(state.sliceDoc(value.from, value.to)) : null;
}

function elementsOf(array: SyntaxNode): SyntaxNode[] {
  const elements: SyntaxNode[] = [];
  for (let child = array.firstChild; child; child = child.nextSibling) {
    if (child.type.isError || ['[', ']', ','].includes(child.name)) continue;
    elements.push(child);
  }
  return elements;
}

/** Which kind of schema object `object` is, from where it sits in the document. */
export function kindOfObject(state: EditorState, object: SyntaxNode): NodeKind | null {
  const container = object.parent;
  if (!container || container.name === 'JsonText') return 'schema';

  if (container.name === 'Property') {
    const owner = container.parent;
    const ownerKind = owner ? kindOfObject(state, owner) : null;
    const name = propertyName(state, container);
    if (name === 'item' && ownerKind === 'field') return 'field';
    if (name === 'condition' && (ownerKind === 'step' || ownerKind === 'field')) {
      return 'condition';
    }
    if (name === 'of' && ownerKind === 'condition') return 'condition';
    return null;
  }

  if (container.name === 'Array') {
    const property = container.parent;
    const owner = property?.parent;
    const ownerKind = owner ? kindOfObject(state, owner) : null;
    const name = property ? propertyName(state, property) : null;
    if (name === 'steps' && ownerKind === 'schema') return 'step';
    if (
      name === 'fields' &&
      (ownerKind === 'schema' || ownerKind === 'step' || ownerKind === 'field')
    ) {
      return 'field';
    }
    if (name === 'options' && ownerKind === 'field') return 'option';
    if (name === 'of' && ownerKind === 'condition') return 'condition';
  }
  return null;
}

/** The innermost JSON object containing `pos`, if any. */
export function objectAt(state: EditorState, pos: number): SyntaxNode | null {
  for (let node: SyntaxNode | null = treeOf(state).resolveInner(pos, 1); node; node = node.parent) {
    if (node.name === 'Object') return node;
  }
  return null;
}

/** The kind of the innermost schema object around `pos`. */
export function objectKindAt(state: EditorState, pos: number): NodeKind | null {
  const object = objectAt(state, pos);
  return object ? kindOfObject(state, object) : null;
}

const SCALARS = new Set(['String', 'Number', 'True', 'False', 'Null']);

/**
 * Where a path from the server lives in the text. A scalar property is marked
 * whole (`"maxLength": 5`); a property holding an object or list only by its
 * key, and a list element by its opening brace, so a long block is never
 * underlined entirely. A path that doesn't exist (a missing property) falls
 * back to the nearest thing that does.
 */
export function locatePath(state: EditorState, path: string): TextRange | null {
  const root = treeOf(state).topNode.firstChild;
  if (!root || root.name !== 'Object') return null;

  let node: SyntaxNode = root;
  let range: TextRange = { from: root.from, to: root.from + 1 };

  for (const segment of pathSegments(path)) {
    if (typeof segment === 'string') {
      if (node.name !== 'Object') break;
      const property = findProperty(state, node, segment);
      if (!property) break;
      const value = propertyValue(property);
      const key = propertyNameNode(property);
      range =
        value && SCALARS.has(value.name)
          ? { from: property.from, to: property.to }
          : { from: key?.from ?? property.from, to: key?.to ?? property.to };
      if (!value) break;
      node = value;
    } else {
      if (node.name !== 'Array') break;
      const element = elementsOf(node)[segment];
      if (!element) break;
      range = SCALARS.has(element.name)
        ? { from: element.from, to: element.to }
        : { from: element.from, to: element.from + 1 };
      node = element;
    }
  }
  return range;
}
