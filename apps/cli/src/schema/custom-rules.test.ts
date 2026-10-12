import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CliError, ExitCode } from '../errors.js';
import { applyCustomRules, precheckSchema, ruleCode } from './custom-rules.js';
import { parseRuleFile, type CustomRule } from './rules.js';
import { getSchemaTemplate } from './templates.js';
import { validateSchema } from './validate.js';

const rules = (...defs: object[]): CustomRule[] => parseRuleFile(JSON.stringify({ rules: defs }), '/t/rules.json');
const field = (extra: object = {}) => ({ key: 'name', type: 'string', required: true, ...extra });
const schema = (...fields: object[]) => ({ version: 1, steps: [{ key: 'about', fields }] });
const found = (s: unknown, r: CustomRule[]) => applyCustomRules(s, r).map((e) => `${e.path} ${e.code}`);

const requireLabel = { id: 'require-label', type: 'require-present', appliesTo: '*', field: 'label', message: 'Needs a label' };
const snakeKeys = { id: 'snake-keys', type: 'key-pattern', appliesTo: '*', pattern: '^[a-z][a-z0-9_]*$', message: 'snake_case' };
const maxLen = { id: 'max-len', type: 'max-value', appliesTo: ['string', 'text'], field: 'maxLength', max: 500, message: 'Too long' };
const noBrackets = { id: 'no-brackets', type: 'forbid-pattern', appliesTo: ['string', 'text', 'multi_enum'], field: 'default', pattern: '[<>]', message: 'No < or >' };

describe('applyCustomRules', () => {
  it('require-present: flags missing, null, blank and empty values', () => {
    const r = rules(requireLabel);
    expect(found(schema(field({ label: 'Name' })), r)).toEqual([]);
    for (const label of [undefined, null, '', '   ', []]) {
      expect(found(schema(field({ label })), r)).toEqual(['steps[0].fields[0].label REQUIRE_LABEL']);
    }
  });

  it('key-pattern: checks every field key, but leaves non-string keys to the built-in checks', () => {
    const r = rules(snakeKeys);
    expect(found(schema(field({ key: 'first_name' })), r)).toEqual([]);
    expect(found(schema(field({ key: 'FirstName' })), r)).toEqual(['steps[0].fields[0].key SNAKE_KEYS']);
    expect(found(schema(field({ key: 42 })), r)).toEqual([]);
  });

  it('max-value: only checks numbers above the ceiling', () => {
    const r = rules(maxLen);
    expect(found(schema(field({ maxLength: 500 })), r)).toEqual([]);
    expect(found(schema(field({ maxLength: 501 })), r)).toEqual(['steps[0].fields[0].maxLength MAX_LEN']);
    expect(found(schema(field()), r)).toEqual([]); // absent passes; pair with require-present if needed
    expect(found(schema(field({ maxLength: 'x' })), r)).toEqual([]);
  });

  it('forbid-pattern: checks strings and string arrays, with item paths', () => {
    const r = rules(noBrackets);
    expect(found(schema(field({ default: 'safe' })), r)).toEqual([]);
    expect(found(schema(field({ default: '<b>hi</b>' })), r)).toEqual(['steps[0].fields[0].default NO_BRACKETS']);
    const multi = { key: 'tags', type: 'multi_enum', required: false, options: [{ value: 'a' }], default: ['ok', 'x>y'] };
    expect(found(schema(multi), r)).toEqual(['steps[0].fields[0].default[1] NO_BRACKETS']);
    expect(found(schema(field({ default: 5 })), r)).toEqual([]);
  });

  it('appliesTo limits a rule to the listed field types', () => {
    const r = rules(maxLen);
    expect(found(schema({ key: 'n', type: 'number', required: true, maxLength: 9999 }), r)).toEqual([]);
    expect(found(schema({ key: 't', type: 'text', required: true, maxLength: 9999 }), r)).toEqual(['steps[0].fields[0].maxLength MAX_LEN']);
  });

  it('reaches nested object fields and array items, with the built-in path format', () => {
    const nested = schema({
      key: 'team',
      type: 'array',
      required: true,
      maxItems: 3,
      item: { key: 'member', type: 'object', required: true, fields: [field({ key: 'full_name' }), field({ key: 'Role' })] },
    });
    expect(found(nested, rules(snakeKeys))).toEqual(['steps[0].fields[0].item.fields[1].key SNAKE_KEYS']);
    expect(found(nested, rules(requireLabel))).toEqual([
      'steps[0].fields[0].label REQUIRE_LABEL',
      'steps[0].fields[0].item.label REQUIRE_LABEL',
      'steps[0].fields[0].item.fields[0].label REQUIRE_LABEL',
      'steps[0].fields[0].item.fields[1].label REQUIRE_LABEL',
    ]);
  });

  it('reports every failure, in schema order, with the rule message and source "local"', () => {
    const errors = applyCustomRules(schema(field({ key: 'A' }), field({ key: 'b', label: 'B' })), rules(requireLabel, snakeKeys));
    expect(errors).toEqual([
      { path: 'steps[0].fields[0].label', code: 'REQUIRE_LABEL', message: 'Needs a label', source: 'local' },
      { path: 'steps[0].fields[0].key', code: 'SNAKE_KEYS', message: 'snake_case', source: 'local' },
    ]);
  });

  it('does not crash on malformed schemas (those are the built-in checks\' job)', () => {
    const r = rules(requireLabel, snakeKeys, maxLen, noBrackets);
    for (const bad of [null, 'x', [], {}, { steps: 'x' }, { steps: [null, { fields: 'x' }, { fields: [null, 7, { fields: 'y', item: 3 }] }] }]) {
      expect(() => applyCustomRules(bad, r)).not.toThrow();
    }
  });

  it('turns ids into codes', () => {
    expect(ruleCode('no-angle-brackets-2')).toBe('NO_ANGLE_BRACKETS_2');
  });

  it('interrupts a catastrophically backtracking pattern instead of hanging', () => {
    const evil = rules({ id: 'evil', type: 'forbid-pattern', appliesTo: '*', field: 'default', pattern: '^(a+)+$', message: 'm' });
    const started = Date.now();
    let error: unknown;
    try {
      applyCustomRules(schema(field({ default: `${'a'.repeat(40)}!` })), evil);
    } catch (err) {
      error = err;
    }
    expect(Date.now() - started).toBeLessThan(2000);
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(ExitCode.PrecheckFailed);
    expect((error as CliError).message).toMatch(/"evil" \(\/t\/rules\.json\).*took longer than 100ms on steps\[0\]\.fields\[0\]\.default/);
  });
});

describe('precheckSchema', () => {
  it('combines built-in and custom errors', () => {
    const result = precheckSchema(schema(field({ key: 'Bad', type: 'colour' })), rules(snakeKeys));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(['UNKNOWN_TYPE', 'SNAKE_KEYS']);
  });

  it('can never make a schema the built-in checks reject pass (strictly additive)', () => {
    const invalid = [schema(field({ type: 'colour' })), schema({ key: 'l', type: 'array', required: true, item: field() }), { version: 2, steps: [] }];
    const everyRule = rules(requireLabel, snakeKeys, maxLen, noBrackets);
    for (const s of invalid) {
      const builtIn = validateSchema(s).errors;
      const result = precheckSchema(s, everyRule);
      expect(result.valid).toBe(false);
      expect(result.errors.slice(0, builtIn.length)).toEqual(builtIn);
    }
  });

  it('with no custom rules, is exactly the built-in check (MCDI §6.5 example stays valid)', () => {
    const example = getSchemaTemplate('recruitment');
    expect(precheckSchema(example, [])).toEqual(validateSchema(example));
    expect(precheckSchema(example, []).valid).toBe(true);
  });
});

/** tsx's loader, resolved from here since the CLI child runs in a temp directory with no node_modules. */
const TSX_LOADER = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

/** The real `mcdi-cli schema validate` command, run from a temp project with a temp HOME. */
async function cli(args: string[], cwd: string, home: string) {
  const entry = join(import.meta.dirname, '..', 'index.ts');
  const child = spawn(process.execPath, ['--import', TSX_LOADER, entry, ...args], {
    cwd,
    env: { ...process.env, HOME: home, MCDI_CLI_CONFIG_PATH: join(home, 'config.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
  child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
  const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
  return { code, stdout, stderr };
}

describe('mcdi-cli schema validate with custom rules (CLI)', () => {
  async function workspace() {
    const root = await mkdtemp(join(tmpdir(), 'mcdi-cli-rules-cli-'));
    const home = join(root, 'home');
    const repo = join(root, 'repo');
    await mkdir(join(home, '.mcdi-cli', 'rules'), { recursive: true });
    await mkdir(join(repo, '.mcdi-cli', 'rules'), { recursive: true });
    await mkdir(join(repo, 'forms'), { recursive: true });
    await writeFile(join(repo, 'forms', 'form.json'), JSON.stringify(schema(field({ key: 'FullName', label: 'Name' }), field({ key: 'email' }))));
    return { home, repo };
  }

  it('reports global and project rule failures in the built-in format and exits 1', async () => {
    const { home, repo } = await workspace();
    await writeFile(join(home, '.mcdi-cli', 'rules', 'team.json'), JSON.stringify({ rules: [requireLabel] }));
    await writeFile(join(repo, '.mcdi-cli', 'rules', 'project.json'), JSON.stringify({ rules: [snakeKeys] }));

    const { code, stderr } = await cli(['schema', 'validate', 'form.json'], join(repo, 'forms'), home);
    expect(stderr).toBe(
      '✗ 2 validation errors (source: local)\n' +
        '  steps[0].fields[0].key  SNAKE_KEYS  snake_case\n' +
        '  steps[0].fields[1].label  REQUIRE_LABEL  Needs a label\n',
    );
    expect(code).toBe(1);
  }, 20_000);

  it('passes when the schema satisfies every rule', async () => {
    const { home, repo } = await workspace();
    await writeFile(join(repo, 'forms', 'ok.json'), JSON.stringify(schema(field({ key: 'full_name', label: 'Name' }))));
    await writeFile(join(repo, '.mcdi-cli', 'rules', 'project.json'), JSON.stringify({ rules: [requireLabel, snakeKeys] }));
    const { code, stdout } = await cli(['schema', 'validate', 'ok.json'], join(repo, 'forms'), home);
    expect(stdout).toBe('✓ Schema is valid (source: local)\n');
    expect(code).toBe(0);
  }, 20_000);

  it('names the broken rule file and exits 1', async () => {
    const { home, repo } = await workspace();
    const broken = join(repo, '.mcdi-cli', 'rules', 'broken.json');
    await writeFile(broken, JSON.stringify({ rules: [{ ...requireLabel, type: 'eval' }] }));
    const { code, stderr } = await cli(['schema', 'validate', 'form.json'], join(repo, 'forms'), home);
    expect(stderr).toContain('✗ Could not load custom rules (source: local)');
    expect(stderr).toContain(`${broken}  INVALID_RULE  rules[0] ("require-label"): "type" must be one of`);
    expect(code).toBe(1);
  }, 20_000);
});
