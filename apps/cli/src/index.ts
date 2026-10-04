#!/usr/bin/env node
import { Command } from 'commander';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerWhoamiCommand } from './commands/whoami.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerSchemaCommand } from './commands/schema.js';
import { registerWebhookCommand } from './commands/webhook.js';
import { registerConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('m-forge')
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
