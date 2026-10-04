import { Command } from 'commander';
import { exitWithError } from '../errors.js';
import { defaultWhoamiDeps, whoami } from '../whoami.js';

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description("Print the authenticated admin's identity")
    .option('--profile <name>', 'profile to inspect')
    .option('--json', 'emit machine-readable JSON')
    .action(async (options: { profile?: string; json?: boolean }) => {
      try {
        await whoami(options, defaultWhoamiDeps());
      } catch (err) {
        exitWithError('whoami', err);
      }
    });
}
