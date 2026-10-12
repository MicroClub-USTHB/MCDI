import { createContext, Script } from 'node:vm';
import { CliError, ExitCode } from '../errors.js';
import type { CustomRule } from './rules.js';
import { validateSchema, type ValidationError, type ValidationResult } from './validate.js';

/**
 * Applies custom rules to a schema. Rules can only add errors on top of the
 * built-in (MCDI Layer 1) checks, never remove or relax one, so the local
 * pre-check can only ever be stricter than MCDI.
 */

/** A rule pattern that runs longer than this on one value is treated as broken (e.g. `(a+)+$`). */
export const PATTERN_TIMEOUT_MS = 100;

// `vm` is used only for its timeout, which interrupts a runaway regex instead of
// hanging the CLI (the same technique MCDI's own payload validator uses).
const sandbox: { re: RegExp; s: string } = { re: /(?:)/, s: '' };
const context = createContext(sandbox);
const testScript = new Script('re.test(s)');

function matches(rule: CustomRule, pattern: RegExp, value: string, path: string): boolean {
  sandbox.re = pattern;
  sandbox.s = value;
  try {
    return testScript.runInContext(context, { timeout: PATTERN_TIMEOUT_MS }) === true;
  } catch {
    throw new CliError(
      `custom rule "${rule.id}" (${rule.file}): its pattern took longer than ${PATTERN_TIMEOUT_MS}ms on ${path}; ` +
        'simplify the pattern (nested quantifiers like (a+)+ backtrack catastrophically)',
      ExitCode.PrecheckFailed,
    );
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `require-label` → `REQUIRE_LABEL`. */
export const ruleCode = (id: string): string => id.toUpperCase().replace(/-/g, '_');

const isMissing = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

function checkField(field: Record<string, unknown>, path: string, rules: readonly CustomRule[], errors: ValidationError[]): void {
  const type = field.type;
  for (const rule of rules) {
    if (rule.appliesTo !== '*' && (typeof type !== 'string' || !rule.appliesTo.includes(type))) continue;
    const add = (at: string) => errors.push({ path: at, code: ruleCode(rule.id), message: rule.message, source: 'local' });

    switch (rule.type) {
      case 'require-present':
        if (isMissing(field[rule.field!])) add(`${path}.${rule.field}`);
        break;
      case 'key-pattern':
        // A missing or non-string key is already a built-in error.
        if (typeof field.key === 'string' && !matches(rule, rule.pattern!, field.key, `${path}.key`)) add(`${path}.key`);
        break;
      case 'max-value': {
        const value = field[rule.field!];
        if (typeof value === 'number' && value > rule.max!) add(`${path}.${rule.field}`);
        break;
      }
      case 'forbid-pattern': {
        const value = field[rule.field!];
        const at = `${path}.${rule.field}`;
        if (typeof value === 'string') {
          if (matches(rule, rule.pattern!, value, at)) add(at);
        } else if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (typeof item === 'string' && matches(rule, rule.pattern!, item, `${at}[${i}]`)) add(`${at}[${i}]`);
          });
        }
        break;
      }
    }
  }

  // Nested fields get the same rules, with the same paths the built-in checks use.
  if (Array.isArray(field.fields)) {
    field.fields.forEach((child, i) => {
      if (isRecord(child)) checkField(child, `${path}.fields[${i}]`, rules, errors);
    });
  }
  if (isRecord(field.item)) checkField(field.item, `${path}.item`, rules, errors);
}

/** Custom-rule errors only. Tolerates malformed schemas: structure problems are the built-in checks' job. */
export function applyCustomRules(schema: unknown, rules: readonly CustomRule[]): ValidationError[] {
  const errors: ValidationError[] = [];
  if (rules.length === 0 || !isRecord(schema) || !Array.isArray(schema.steps)) return errors;
  schema.steps.forEach((step, s) => {
    if (!isRecord(step) || !Array.isArray(step.fields)) return;
    step.fields.forEach((field, f) => {
      if (isRecord(field)) checkField(field, `steps[${s}].fields[${f}]`, rules, errors);
    });
  });
  return errors;
}

/** The full local pre-check: MCDI's Layer 1 checks, plus any custom rules on top. */
export function precheckSchema(schema: unknown, rules: readonly CustomRule[]): ValidationResult {
  const errors = [...validateSchema(schema).errors, ...applyCustomRules(schema, rules)];
  return { valid: errors.length === 0, errors };
}
