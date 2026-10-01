/**
 * Evaluates a Condition against accumulated submission data.
 *
 * A deliberately tiny interpreter over a fixed AST — never `eval`, never a
 * JS expression string, so a stored condition can never execute code.
 */
import { Condition } from './form-schema.types';

/** Reads a dotted path, e.g. "identity.status". Returns undefined if absent. */
export function readPath(data: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = data;
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function compare(op: string, left: unknown, right: unknown): boolean {
  switch (op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      // Only meaningful for numbers and comparable strings; anything else is false
      if (typeof left !== typeof right) return false;
      if (typeof left !== 'number' && typeof left !== 'string') return false;
      const l = left;
      const r = right as number | string;
      if (op === 'gt') return l > r;
      if (op === 'lt') return l < r;
      if (op === 'gte') return l >= r;
      return l <= r;
    }
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'contains':
      if (Array.isArray(left)) return left.includes(right);
      if (typeof left === 'string' && typeof right === 'string') {
        return left.includes(right);
      }
      return false;
    case 'exists':
      return left !== undefined && left !== null;
    default:
      return false;
  }
}

export function evaluateCondition(
  condition: Condition | undefined,
  data: Record<string, unknown>,
): boolean {
  // No condition means always active.
  if (condition === undefined) return true;

  if (condition.op === 'and') {
    return condition.of.every((c) => evaluateCondition(c, data));
  }
  if (condition.op === 'or') {
    return condition.of.some((c) => evaluateCondition(c, data));
  }
  if (condition.op === 'not') {
    return !evaluateCondition(condition.of, data);
  }

  const left = readPath(data, condition.field);
  return compare(condition.op, left, condition.value);
}
