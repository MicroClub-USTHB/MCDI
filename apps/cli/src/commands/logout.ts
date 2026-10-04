import { Command } from 'commander';
import { notImplemented } from '../not-implemented.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Invalidate the current session and forget it locally')
    .option('--profile <name>', 'profile to log out of')
    .action(() => notImplemented('logout', 4));
}
