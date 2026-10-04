import { Command } from 'commander';
import { notImplemented } from '../not-implemented.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate against MCDI via browser-based Discord OAuth')
    .option('--profile <name>', 'profile to log in on')
    .option('--base-url <url>', 'MCDI base URL for this profile')
    .action(() => notImplemented('login', 1));
}
