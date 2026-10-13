import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { INBOUND_WEBHOOK_TEMPLATES } from '@mcdi/contracts';
import { Command } from 'commander';
import { CliError, ExitCode } from '../errors.js';
import { precheckSchema } from '../schema/custom-rules.js';
import { defaultRuleLocations, loadCustomRules, RuleFileError } from '../schema/rules.js';

/** The same templates the admin panel's schema editor offers. */
const TEMPLATE_IDS = INBOUND_WEBHOOK_TEMPLATES.map((template) => template.id);
const DEFAULT_TEMPLATE = 'blank';
const DEFAULT_OUTPUT_PATH = 'schema.json';
const FILE_ENCODING = 'utf8';
const CREATE_ONLY = 'wx';
const JSON_INDENT = 2;

const OUTPUT_SOURCE = 'local';

export function registerSchemaCommand(program: Command): void {
  const schema = program
    .command('schema')
    .description('Scaffold and validate Inbound Webhook FormSchema files');

  schema
    .command('init [path]')
    .description('Scaffold a starter FormSchema JSON file')
    .option('--template <name>', `template to scaffold from: ${TEMPLATE_IDS.join(', ')}`)
    .action(async (path: string | undefined, options: { template?: string }) => {
      const templateName = options.template ?? DEFAULT_TEMPLATE;
      const template = INBOUND_WEBHOOK_TEMPLATES.find(({ id }) => id === templateName);
      if (!template) {
        process.stderr.write(
          `Unknown schema template "${templateName}". Available templates: ${TEMPLATE_IDS.join(', ')}\n`,
        );
        process.exitCode = ExitCode.PrecheckFailed;
        return;
      }

      const outputPath = resolve(path ?? DEFAULT_OUTPUT_PATH);
      try {
        const json = JSON.stringify(template.schema, null, JSON_INDENT);
        await writeFile(outputPath, `${json}\n`, { flag: CREATE_ONLY });
        process.stdout.write(`Created ${outputPath}\n`);
      } catch (error) {
        if (isNodeError(error) && error.code === 'EEXIST') {
          process.stderr.write(`File already exists: ${outputPath}\n`);
          process.exitCode = ExitCode.PrecheckFailed;
          return;
        }
        process.stderr.write(`Could not create ${outputPath}: ${errorMessage(error)}\n`);
        process.exitCode = ExitCode.Unexpected;
      }
    });

  schema
    .command('validate <path>')
    .description('Run the local pre-check only, no network call')
    .action(async (path: string) => {
      let contents: string;
      try {
        contents = await readFile(path, FILE_ENCODING);
      } catch (error) {
        printError(
          `Could not read schema (source: ${OUTPUT_SOURCE})`,
          path,
          'FILE_READ_ERROR',
          errorMessage(error),
        );
        process.exitCode = ExitCode.Unexpected;
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(contents) as unknown;
      } catch (error) {
        printValidationErrors([{ path, code: 'INVALID_JSON', message: errorMessage(error) }]);
        process.exitCode = ExitCode.PrecheckFailed;
        return;
      }

      let result;
      try {
        result = precheckSchema(parsed, await loadCustomRules(defaultRuleLocations()));
      } catch (error) {
        if (error instanceof RuleFileError) {
          printError(
            `Could not load custom rules (source: ${OUTPUT_SOURCE})`,
            error.file,
            'INVALID_RULE',
            error.problem,
          );
        } else if (error instanceof CliError) {
          printError(
            `Custom rule failed (source: ${OUTPUT_SOURCE})`,
            path,
            'RULE_TIMEOUT',
            error.message,
          );
        } else {
          throw error;
        }
        process.exitCode = ExitCode.PrecheckFailed;
        return;
      }
      if (!result.valid) {
        printValidationErrors(result.errors);
        process.exitCode = ExitCode.PrecheckFailed;
        return;
      }
      process.stdout.write(`✓ Schema is valid (source: ${OUTPUT_SOURCE})\n`);
      process.exitCode = ExitCode.Ok;
    });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printValidationErrors(
  errors: Array<{ path: string; code: string; message: string }>,
): void {
  const count = errors.length;
  const noun = count === 1 ? 'error' : 'errors';
  process.stderr.write(`✗ ${count} validation ${noun} (source: ${OUTPUT_SOURCE})\n`);
  for (const error of errors) {
    process.stderr.write(`  ${error.path}  ${error.code}  ${error.message}\n`);
  }
}

function printError(title: string, path: string, code: string, message: string): void {
  process.stderr.write(`✗ ${title}\n  ${path}  ${code}  ${message}\n`);
}
