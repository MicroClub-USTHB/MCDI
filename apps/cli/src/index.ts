#!/usr/bin/env node
import { Command } from 'commander';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerWhoamiCommand } from './commands/whoami.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerSchemaCommand } from './commands/schema.js';
import { registerWebhookCommand } from './commands/webhook.js';
import { registerConfigCommand } from './commands/config.js';

// When stdout is closed early (e.g. `mcdi-cli webhook list | head`), stop quietly
// instead of crashing with an unhandled EPIPE stack trace.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const program = new Command();

program
  .name('mcdi-cli')
  .description(
    'Authenticate against MCDI and author, validate, create, update, and inspect Inbound Webhooks from the terminal',
  )
  .version('0.0.0');

registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerProfileCommand(program);
registerSchemaCommand(program);
registerWebhookCommand(program);
registerConfigCommand(program);

program.parseAsync(process.argv);
