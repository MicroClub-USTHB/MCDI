import { Command } from 'commander';
import { exitWithError } from '../errors.js';
import {
  defaultWebhookDeps,
  webhookCreate,
  webhookDelete,
  webhookGet,
  webhookList,
  webhookRolesSet,
  webhookRotateSecret,
  webhookSecretGet,
  webhookUpdate,
  type WebhookCreateOptions,
  type WebhookDeleteOptions,
  type WebhookGetOptions,
  type WebhookListOptions,
  type WebhookRolesSetOptions,
  type WebhookRotateSecretOptions,
  type WebhookSecretGetOptions,
  type WebhookUpdateOptions,
} from '../webhook-flow.js';

export function registerWebhookCommand(program: Command): void {
  const webhook = program.command('webhook').description('Manage MCDI Inbound Webhooks');

  webhook
    .command('create <schema-path>')
    .description('Create a webhook on MCDI from a schema file and store its signing secret')
    .requiredOption('--name <name>', 'webhook display name')
    .option('--project <projectId>', 'owning MCDI project id (omit to pick interactively)')
    .requiredOption(
      '--roles <roleIds>',
      'comma-separated Discord role ids allowed to read submissions',
    )
    .option('--accept-origin <origin>', 'accepted origin (repeatable)', collect, [])
    .option('--slug <slug>', 'URL-safe id, unique in the project (default: derived from --name)')
    .option('--reveal', 'print the signing secret in plain text')
    .requiredOption('--profile <name>', 'profile to create on')
    .action(async (schemaPath: string, options: WebhookCreateOptions) => {
      try {
        await webhookCreate(schemaPath, options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook create', err);
      }
    });

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
    .requiredOption('--profile <name>', 'profile to delete on')
    .action(async (id: string, options: WebhookDeleteOptions) => {
      try {
        await webhookDelete(id, options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook delete', err);
      }
    });

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
    .option('--yes', 'skip the confirmation prompt')
    .requiredOption('--profile <name>', 'profile to rotate on')
    .action(async (id: string, options: WebhookRotateSecretOptions) => {
      try {
        await webhookRotateSecret(id, options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook rotate-secret', err);
      }
    });

  const secret = webhook.command('secret').description('Read a locally stored signing secret');
  secret
    .command('get')
    .description('Retrieve a stored signing secret (prompts if more than one is stored)')
    .option('--reveal', 'print the secret in plain text')
    .option('--profile <name>', 'profile to read from')
    .action(async (options: WebhookSecretGetOptions) => {
      try {
        await webhookSecretGet(options, defaultWebhookDeps());
      } catch (err) {
        exitWithError('webhook secret get', err);
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
