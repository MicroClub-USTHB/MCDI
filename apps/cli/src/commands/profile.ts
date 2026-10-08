import { Command } from 'commander';
import { exitWithError } from '../errors.js';
import { defaultProfileDeps, profileAdd, profileList, profileRemove, profileUse } from '../profile.js';

export function registerProfileCommand(program: Command): void {
  const profile = program
    .command('profile')
    .description('Manage named MCDI profiles (base URL + session)');

  profile
    .command('list')
    .description('List configured profiles')
    .action(async () => {
      try {
        await profileList(defaultProfileDeps());
      } catch (err) {
        exitWithError('profile list', err);
      }
    });

  profile
    .command('add <name>')
    .description('Add a new profile')
    .requiredOption('--base-url <url>', 'MCDI base URL for this profile')
    .action(async (name: string, options: { baseUrl: string }) => {
      try {
        await profileAdd(name, options, defaultProfileDeps());
      } catch (err) {
        exitWithError('profile add', err);
      }
    });

  profile
    .command('use <name>')
    .description('Set the active profile')
    .action(async (name: string) => {
      try {
        await profileUse(name, defaultProfileDeps());
      } catch (err) {
        exitWithError('profile use', err);
      }
    });

  profile
    .command('remove <name>')
    .description('Remove a profile')
    .option('--yes', 'skip the confirmation prompt when secrets would be lost')
    .action(async (name: string, options: { yes?: boolean }) => {
      try {
        await profileRemove(name, options, defaultProfileDeps());
      } catch (err) {
        exitWithError('profile remove', err);
      }
    });
}
