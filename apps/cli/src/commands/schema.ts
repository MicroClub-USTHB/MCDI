import { Command } from 'commander';
import { notImplemented } from '../not-implemented.js';

export function registerSchemaCommand(program: Command): void {
  const schema = program
    .command('schema')
    .description('Scaffold, validate, and build Inbound Webhook FormSchema files');

  schema
    .command('init [path]')
    .description('Scaffold a starter FormSchema JSON file')
    .option('--template <name>', 'named template to scaffold from')
    .action(() => notImplemented('schema init', 5));

  schema
    .command('validate <path>')
    .description('Run the local pre-check only, no network call')
    .action(() => notImplemented('schema validate', 5));

  schema
    .command('build [path]')
    .description('Launch the interactive schema wizard')
    .option('--from <path>', 'load an existing file into the wizard')
    .action(() => notImplemented('schema build'));
}
