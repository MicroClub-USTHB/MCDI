#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { ExitCode } from './errors.js';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerWhoamiCommand } from './commands/whoami.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerSchemaCommand } from './commands/schema.js';
import { registerWebhookCommand } from './commands/webhook.js';
import { registerConfigCommand } from './commands/config.js';

// When stdout is closed early (e.g. `mcid-cli webhook list | head`), stop quietly
// instead of crashing with an unhandled EPIPE stack trace.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

// package.json sits one level up from both src/ (tsx) and dist/ (the published bundle).
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const program = new Command();

// Before the subcommands are added, so they inherit it: usage errors get their
// own exit code instead of sharing 1 with a failed schema pre-check.
program.exitOverride((err) => {
  const done = err.code === 'commander.helpDisplayed' || err.code === 'commander.version';
  process.exit(done || err.exitCode === 0 ? ExitCode.Ok : ExitCode.Usage);
});

program
  .name('mcid-cli')
  .description(
    'Authenticate against MCID and author, validate, create, update, and inspect Inbound Webhooks from the terminal',
  )
  .version(version);

registerLoginCommand(program);
registerLogoutCommand(program);
registerWhoamiCommand(program);
registerProfileCommand(program);
registerSchemaCommand(program);
registerWebhookCommand(program);
registerConfigCommand(program);

program.parseAsync(process.argv);
