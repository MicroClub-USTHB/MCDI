import { Command } from 'commander';
import { notImplemented } from '../not-implemented.js';

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description("Print the authenticated admin's identity")
    .option('--profile <name>', 'profile to inspect')
    .option('--json', 'emit machine-readable JSON')
    .action(() => notImplemented('whoami', 3));
}
