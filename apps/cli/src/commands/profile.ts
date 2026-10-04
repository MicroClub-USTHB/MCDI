import { Command } from 'commander';
import { notImplemented } from '../not-implemented.js';

export function registerProfileCommand(program: Command): void {
  const profile = program
    .command('profile')
    .description('Manage named MCDI profiles (base URL + session)');

  profile
    .command('list')
    .description('List configured profiles')
    .action(() => notImplemented('profile list'));

  profile
    .command('add <name>')
    .description('Add a new profile')
    .requiredOption('--base-url <url>', 'MCDI base URL for this profile')
    .action(() => notImplemented('profile add'));

  profile
    .command('use <name>')
    .description('Set the active profile')
    .action(() => notImplemented('profile use'));

  profile
    .command('remove <name>')
    .description('Remove a profile')
    .action(() => notImplemented('profile remove'));
}
