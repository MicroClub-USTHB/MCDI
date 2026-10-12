import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { configDir } from '../config.js';
import { CliError, ExitCode } from '../errors.js';
import { FIELD_TYPE_NAMES } from './validate.js';

/**
 * Custom ("house") validation rules, loaded from `.mcdi-cli/rules/*.json` in the
 * project and `~/.mcdi-cli/rules/*.json` globally (PRD §9.2). Rule files are
 * read as plain JSON and checked against a closed set of rule types; nothing in
 * them is ever executed.
 */

export const RULE_TYPES = [
  'forbid-pattern',
  'require-present',
  'max-value',
  'key-pattern',
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export interface CustomRule {
  id: string;
  type: RuleType;
  /** `'*'` or the field types the rule checks. */
  appliesTo: '*' | readonly string[];
  message: string;
  /** The property checked (forbid-pattern, require-present, max-value). */
  field?: string;
  /** forbid-pattern / key-pattern. */
  pattern?: RegExp;
  /** max-value. */
  max?: number;
  /** The file the rule came from, for error messages. */
  file: string;
}

/** Same limit MCDI puts on stored schema patterns. */
const MAX_PATTERN_LENGTH = 200;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const COMMON_KEYS = ['id', 'type', 'appliesTo', 'message'];
const TYPE_KEYS: Record<RuleType, string[]> = {
  'forbid-pattern': ['field', 'pattern'],
  'require-present': ['field'],
  'max-value': ['field', 'max'],
  'key-pattern': ['pattern'],
};

/** A rule file that can't be used; always names the file (and rule) at fault. */
export class RuleFileError extends CliError {
  constructor(
    readonly file: string,
    readonly problem: string,
  ) {
    super(`custom rules ${file}: ${problem}`, ExitCode.PrecheckFailed);
    this.name = 'RuleFileError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseRule(raw: unknown, index: number, file: string): CustomRule {
  const where =
    isRecord(raw) && typeof raw.id === 'string'
      ? `rules[${index}] ("${raw.id}")`
      : `rules[${index}]`;
  const fail = (problem: string): never => {
    throw new RuleFileError(file, `${where}: ${problem}`);
  };
  if (!isRecord(raw)) return fail('must be an object');

  const { id, type, appliesTo, message } = raw;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    fail('"id" must be 1-64 lowercase letters, digits, or dashes, starting with a letter or digit');
  }
  if (typeof type !== 'string' || !(RULE_TYPES as readonly string[]).includes(type)) {
    fail(`"type" must be one of ${RULE_TYPES.join(', ')}`);
  }
  const ruleType = type as RuleType;

  const allowed = new Set([...COMMON_KEYS, ...TYPE_KEYS[ruleType]]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) fail(`unknown property "${key}" for a ${ruleType} rule`);
  }
  for (const key of TYPE_KEYS[ruleType]) {
    if (!(key in raw)) fail(`a ${ruleType} rule needs "${key}"`);
  }

  let targets: CustomRule['appliesTo'];
  if (appliesTo === '*') {
    targets = '*';
  } else if (Array.isArray(appliesTo) && appliesTo.length > 0) {
    for (const t of appliesTo) {
      if (typeof t !== 'string' || !FIELD_TYPE_NAMES.includes(t))
        fail(`"appliesTo" has unknown field type ${JSON.stringify(t)}`);
    }
    targets = appliesTo as string[];
  } else {
    return fail('"appliesTo" must be "*" or a non-empty array of field types');
  }

  if (typeof message !== 'string' || message.trim() === '')
    fail('"message" must be a non-empty string');

  const rule: CustomRule = {
    id: id as string,
    type: ruleType,
    appliesTo: targets,
    message: message as string,
    file,
  };

  if ('field' in raw) {
    if (typeof raw.field !== 'string' || raw.field === '')
      fail('"field" must be a non-empty property name');
    rule.field = raw.field as string;
  }
  if ('pattern' in raw) {
    const source = raw.pattern;
    if (typeof source !== 'string' || source === '') fail('"pattern" must be a non-empty string');
    if ((source as string).length > MAX_PATTERN_LENGTH)
      fail(`"pattern" exceeds ${MAX_PATTERN_LENGTH} characters`);
    try {
      rule.pattern = new RegExp(source as string);
    } catch {
      fail('"pattern" is not a valid regular expression');
    }
  }
  if ('max' in raw) {
    if (typeof raw.max !== 'number' || !Number.isFinite(raw.max))
      fail('"max" must be a finite number');
    rule.max = raw.max as number;
  }
  return rule;
}

/** Parses one rule file's text. Exported for tests. */
export function parseRuleFile(text: string, file: string): CustomRule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new RuleFileError(
      file,
      `not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.rules)) {
    throw new RuleFileError(file, 'must be an object with a "rules" array');
  }
  for (const key of Object.keys(parsed)) {
    if (key !== 'rules') throw new RuleFileError(file, `unknown top-level property "${key}"`);
  }
  return parsed.rules.map((raw, index) => parseRule(raw, index, file));
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Every rule in a directory's `*.json` files, in file-name order. Duplicate ids in one directory are an error. */
async function loadRulesDir(dir: string): Promise<CustomRule[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  const rules: CustomRule[] = [];
  const seen = new Map<string, string>();
  for (const name of names) {
    const file = join(dir, name);
    for (const rule of parseRuleFile(await readFile(file, 'utf8'), file)) {
      const earlier = seen.get(rule.id);
      if (earlier)
        throw new RuleFileError(file, `duplicate rule id "${rule.id}" (also in ${earlier})`);
      seen.set(rule.id, file);
      rules.push(rule);
    }
  }
  return rules;
}

/** The nearest `.mcdi-cli/rules` directory from `startDir` upwards, like git looks for `.git`. */
export async function findProjectRulesDir(startDir: string): Promise<string | undefined> {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, '.mcdi-cli', 'rules');
    if (await isDirectory(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export interface RuleLocations {
  /** Where to start looking for the project's `.mcdi-cli/rules`. */
  cwd: string;
  /** The global rules directory, normally `~/.mcdi-cli/rules`. */
  globalDir: string;
}

/** The current directory upwards for project rules, and `~/.mcdi-cli/rules` for global ones. */
export function defaultRuleLocations(): RuleLocations {
  return { cwd: process.cwd(), globalDir: join(configDir(), 'rules') };
}

/**
 * Global rules first, then project rules. A project rule with the same id as a
 * global one replaces it, so a project can tune a team-wide rule.
 */
export async function loadCustomRules({ cwd, globalDir }: RuleLocations): Promise<CustomRule[]> {
  const globalRules = (await isDirectory(globalDir)) ? await loadRulesDir(globalDir) : [];
  const projectDir = await findProjectRulesDir(cwd);
  // Walking up from inside the home directory can land on the global directory itself.
  if (!projectDir || resolve(projectDir) === resolve(globalDir)) return globalRules;

  const projectRules = await loadRulesDir(projectDir);
  const projectIds = new Set(projectRules.map((rule) => rule.id));
  return [...globalRules.filter((rule) => !projectIds.has(rule.id)), ...projectRules];
}
