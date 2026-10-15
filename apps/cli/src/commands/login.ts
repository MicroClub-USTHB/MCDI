import { Command } from 'commander';
import { exitWithError } from '../errors.js';
import { defaultLoginDeps, login } from '../login-flow.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate against MCID via browser-based Discord OAuth')
    .requiredOption('--profile <name>', 'profile to log in on')
    .option('--base-url <url>', 'MCID base URL for this profile')
    .action(async (options: { profile: string; baseUrl?: string }) => {
      try {
        await login(options, defaultLoginDeps());
      } catch (err) {
        exitWithError('login', err);
      }
    });
}
