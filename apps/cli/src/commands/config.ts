import { Command } from 'commander';
import { notImplemented } from '../not-implemented.js';

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Inspect the m-forge config file');

  config
    .command('path')
    .description('Print the resolved config file location')
    .action(() => notImplemented('config path'));

  config
    .command('show')
    .description('Print a profile with secrets redacted')
    .option('--profile <name>', 'profile to show')
    .action(() => notImplemented('config show'));
}
