import { Command } from 'commander';
import { exitWithError } from '../errors.js';
import { notImplemented } from '../not-implemented.js';
import {
  defaultWebhookDeps,
  webhookGet,
  webhookList,
  webhookRolesSet,
  webhookUpdate,
  type WebhookGetOptions,
  type WebhookListOptions,
  type WebhookRolesSetOptions,
  type WebhookUpdateOptions,
} from '../webhook-flow.js';

export function registerWebhookCommand(program: Command): void {
  const webhook = program
    .command('webhook')
    .description('Manage MCDI Inbound Webhooks');

  webhook
    .command('create <schema-path>')
    .description('Pre-check a schema, then create the webhook on MCDI')
    .requiredOption('--name <name>', 'webhook display name')
    .requiredOption('--project <projectId>', 'owning MCDI project id')
    .requiredOption('--roles <roleIds>', 'comma-separated allowed Discord role ids')
    .option('--accept-origin <origin>', 'accepted origin (repeatable)', collect, [])
    .action(() => notImplemented('webhook create', 7));

  webhook
    .command('update <id>')
    .description('Update an existing webhook')
    .option('--schema <path>', 'replacement schema file')
    .option('--name <name>', 'new display name')
    .option('--active', 'mark the webhook active')
    .option('--inactive', 'mark the webhook inactive')
    .requiredOption('--profile <name>', 'profile to update on')
    .action(async (id: string, options: WebhookUpdateOptions) => {
      try {
        await webhookUpdate(id, options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook update', err);
      }
    });

  webhook
    .command('list')
    .description('List webhooks')
    .option('--project <projectId>', 'filter by project id')
    .option('--profile <name>', 'profile to use')
    .action(async (options: WebhookListOptions) => {
      try {
        await webhookList(options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook list', err);
      }
    });

  webhook
    .command('get <id>')
    .description('Inspect one webhook')
    .option('--schema-only', 'print only the schema')
    .option('--json', 'emit machine-readable JSON')
    .option('--profile <name>', 'profile to use')
    .action(async (id: string, options: WebhookGetOptions) => {
      try {
        await webhookGet(id, options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook get', err);
      }
    });

  webhook
    .command('delete <id>')
    .description('Delete a webhook and all its submissions')
    .option('--yes', 'skip the confirmation prompt')
    .action(() => notImplemented('webhook delete', 11));

  const roles = webhook.command('roles').description('Manage allowed reader roles');
  roles
    .command('set <id>')
    .description('Replace the allowed-reader role list')
    .requiredOption('--roles <roleIds>', 'comma-separated Discord role ids')
    .requiredOption('--profile <name>', 'profile to update on')
    .action(async (id: string, options: WebhookRolesSetOptions) => {
      try {
        await webhookRolesSet(id, options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook roles set', err);
      }
    });

  webhook
    .command('rotate-secret <id>')
    .description("Rotate a webhook's signing secret")
    .option('--reveal', 'print the secret in plain text')
    .action(() => notImplemented('webhook rotate-secret', 8));

  const secret = webhook.command('secret').description('Read a locally stored signing secret');
  secret
    .command('get')
    .description('Retrieve a stored signing secret (prompts if more than one is stored)')
    .option('--reveal', 'print the secret in plain text')
    .option('--profile <name>', 'profile to read from')
    .action(() => notImplemented('webhook secret get', 9));

  webhook
    .command('diff <id> <schema-path>')
    .description("Pre-check a schema file and diff it against the webhook's live schema")
    .action(() => notImplemented('webhook diff'));
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
