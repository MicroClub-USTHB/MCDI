import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExitCode } from '../errors.js';
import { findProjectRulesDir, loadCustomRules, parseRuleFile, RuleFileError } from './rules.js';

const file = (rules: unknown[]) => JSON.stringify({ rules });
const requireLabel = { id: 'require-label', type: 'require-present', appliesTo: '*', field: 'label', message: 'Needs a label' };

function parseError(text: string): RuleFileError {
  try {
    parseRuleFile(text, '/x/rules.json');
  } catch (err) {
    expect(err).toBeInstanceOf(RuleFileError);
    return err as RuleFileError;
  }
  throw new Error('expected parseRuleFile to throw');
}

describe('parseRuleFile', () => {
  it('parses all four rule types', () => {
    const rules = parseRuleFile(
      file([
        requireLabel,
        { id: 'snake-keys', type: 'key-pattern', appliesTo: '*', pattern: '^[a-z_]+$', message: 'snake_case' },
        { id: 'max-len', type: 'max-value', appliesTo: ['string', 'text'], field: 'maxLength', max: 500, message: 'too long' },
        { id: 'no-brackets', type: 'forbid-pattern', appliesTo: ['string'], field: 'default', pattern: '[<>]', message: 'no <>' },
      ]),
      '/x/rules.json',
    );
    expect(rules.map((r) => [r.id, r.type])).toEqual([
      ['require-label', 'require-present'],
      ['snake-keys', 'key-pattern'],
      ['max-len', 'max-value'],
      ['no-brackets', 'forbid-pattern'],
    ]);
    expect(rules[1]!.pattern).toBeInstanceOf(RegExp);
    expect(rules[2]).toMatchObject({ appliesTo: ['string', 'text'], field: 'maxLength', max: 500, file: '/x/rules.json' });
  });

  it('accepts an empty rule list', () => {
    expect(parseRuleFile(file([]), '/x/r.json')).toEqual([]);
  });

  it.each([
    ['not JSON', '{ nope', /not valid JSON/],
    ['no rules array', '{"rule": []}', /"rules" array/],
    ['extra top-level key', '{"rules": [], "extends": "x"}', /unknown top-level property "extends"/],
    ['rule not an object', file(['x']), /rules\[0\]: must be an object/],
    ['bad id', file([{ ...requireLabel, id: 'Bad Id' }]), /"id" must be/],
    ['unknown type (e.g. scripting)', file([{ ...requireLabel, type: 'javascript' }]), /"type" must be one of/],
    ['unknown property', file([{ ...requireLabel, script: 'x' }]), /unknown property "script"/],
    ['property of another type', file([{ ...requireLabel, pattern: 'x' }]), /unknown property "pattern" for a require-present rule/],
    ['missing type-specific key', file([{ id: 'm', type: 'max-value', appliesTo: '*', field: 'maxLength', message: 'm' }]), /needs "max"/],
    ['appliesTo missing', file([{ ...requireLabel, appliesTo: undefined }]), /"appliesTo" must be/],
    ['appliesTo empty', file([{ ...requireLabel, appliesTo: [] }]), /"appliesTo" must be/],
    ['appliesTo unknown type', file([{ ...requireLabel, appliesTo: ['colour'] }]), /unknown field type "colour"/],
    ['empty message', file([{ ...requireLabel, message: ' ' }]), /"message" must be/],
    ['pattern too long', file([{ id: 'k', type: 'key-pattern', appliesTo: '*', pattern: 'a'.repeat(201), message: 'm' }]), /exceeds 200/],
    ['pattern does not compile', file([{ id: 'k', type: 'key-pattern', appliesTo: '*', pattern: '(', message: 'm' }]), /not a valid regular expression/],
    ['max not a number', file([{ id: 'm', type: 'max-value', appliesTo: '*', field: 'maxLength', max: '10', message: 'm' }]), /"max" must be a finite number/],
  ])('rejects %s, naming the file and rule', (_name, text, problem) => {
    const err = parseError(text);
    expect(err.problem).toMatch(problem);
    expect(err.file).toBe('/x/rules.json');
    expect(err.message).toContain('/x/rules.json');
    expect(err.exitCode).toBe(ExitCode.PrecheckFailed);
  });

  it('names the rule id in the error when it has one', () => {
    expect(parseError(file([requireLabel, { ...requireLabel, id: 'second', field: 7 }])).problem).toMatch(/^rules\[1\] \("second"\)/);
  });
});

describe('loading rule directories', () => {
  async function project() {
    const root = await mkdtemp(join(tmpdir(), 'mcdi-cli-rules-'));
    const home = join(root, 'home');
    const repo = join(root, 'repo');
    await mkdir(join(home, '.mcdi-cli', 'rules'), { recursive: true });
    await mkdir(join(repo, '.mcdi-cli', 'rules'), { recursive: true });
    await mkdir(join(repo, 'src', 'deep'), { recursive: true });
    return { root, globalDir: join(home, '.mcdi-cli', 'rules'), projectDir: join(repo, '.mcdi-cli', 'rules'), repo };
  }

  it('finds the nearest .mcdi-cli/rules walking up, like git', async () => {
    const { repo, projectDir, root } = await project();
    expect(await findProjectRulesDir(join(repo, 'src', 'deep'))).toBe(projectDir);
    expect(await findProjectRulesDir(root)).toBeUndefined();
  });

  it('merges global then project rules, the project overriding a global rule with the same id', async () => {
    const { repo, globalDir, projectDir } = await project();
    await writeFile(join(globalDir, 'team.json'), file([requireLabel, { ...requireLabel, id: 'require-description', field: 'description' }]));
    await writeFile(join(projectDir, 'b.json'), file([{ ...requireLabel, message: 'Project wording' }]));
    await writeFile(join(projectDir, 'a.json'), file([{ id: 'snake', type: 'key-pattern', appliesTo: '*', pattern: '^[a-z_]+$', message: 's' }]));
    await writeFile(join(projectDir, 'notes.txt'), 'ignored: not .json');

    const rules = await loadCustomRules({ cwd: join(repo, 'src', 'deep'), globalDir });
    expect(rules.map((r) => `${r.id}:${r.message}`)).toEqual([
      'require-description:Needs a label',
      'snake:s', // a.json before b.json
      'require-label:Project wording',
    ]);
  });

  it('works with only global, only project, or no rules at all', async () => {
    const { root, repo, globalDir } = await project();
    expect(await loadCustomRules({ cwd: root, globalDir: join(root, 'nowhere') })).toEqual([]);
    await writeFile(join(globalDir, 'g.json'), file([requireLabel]));
    expect((await loadCustomRules({ cwd: root, globalDir })).map((r) => r.id)).toEqual(['require-label']);
    expect(await loadCustomRules({ cwd: repo, globalDir: join(root, 'nowhere') })).toEqual([]);
  });

  it('does not load the global directory twice when walking up reaches it', async () => {
    const { root, globalDir } = await project();
    await writeFile(join(globalDir, 'g.json'), file([requireLabel]));
    const rules = await loadCustomRules({ cwd: join(root, 'home'), globalDir });
    expect(rules.map((r) => r.id)).toEqual(['require-label']);
  });

  it('rejects a duplicate id within one directory, naming both files', async () => {
    const { repo, projectDir, root } = await project();
    await writeFile(join(projectDir, 'a.json'), file([requireLabel]));
    await writeFile(join(projectDir, 'b.json'), file([requireLabel]));
    await expect(loadCustomRules({ cwd: repo, globalDir: join(root, 'nowhere') })).rejects.toThrow(
      /b\.json: duplicate rule id "require-label" \(also in .*a\.json\)/,
    );
  });

  it('fails loudly on a broken file instead of skipping it', async () => {
    const { repo, projectDir, root } = await project();
    await writeFile(join(projectDir, 'broken.json'), '{ "rules": [ ');
    await expect(loadCustomRules({ cwd: repo, globalDir: join(root, 'nowhere') })).rejects.toThrow(/broken\.json: not valid JSON/);
  });
});
