import { Command } from 'commander';
import { configShow, configShowPath, defaultConfigDeps } from '../config-show.js';
import { exitWithError } from '../errors.js';

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Inspect the mcid-cli config file');

  config
    .command('path')
    .description('Print the resolved config file location')
    .action(() => {
      try {
        configShowPath(defaultConfigDeps());
      } catch (err) {
        exitWithError('config path', err);
      }
    });

  config
    .command('show')
    .description('Print a profile with secrets redacted')
    .option('--profile <name>', 'profile to show')
    .action(async (options: { profile?: string }) => {
      try {
        await configShow(options, defaultConfigDeps());
      } catch (err) {
        exitWithError('config show', err);
      }
    });
}
