import { Command } from 'commander';
import { exitWithError } from '../errors.js';
import { defaultLogoutDeps, logout } from '../logout.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Invalidate the current session and forget it locally')
    .option('--profile <name>', 'profile to log out of')
    .action(async (options: { profile?: string }) => {
      try {
        await logout(options, defaultLogoutDeps());
      } catch (err) {
        exitWithError('logout', err);
      }
    });
}
