import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import { configDir, configPath, loadConfig, resolveProfileName } from './config.js';
import { decrypt, defaultKeyProvider, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import {
  getInboundWebhook,
  listInboundWebhooks,
  setInboundWebhookRoles,
  updateInboundWebhook,
  type InboundWebhook,
  type InboundWebhookPatch,
} from './mcdi.js';
import { resolveSession, type Session } from './session.js';

export interface WebhookDeps {
  configPath: string;
  keys: KeyProvider;
  /** Results (stdout, so they stay pipeable/scriptable). */
  out: (line: string) => void;
  /** Prompts and hints (stderr, PRD §11). Never given a plaintext secret. */
  info: (line: string) => void;
  /** Whether a human can answer a prompt; when false, nothing may block on input. */
  isInteractive: boolean;
  /** Asks a question on stderr and resolves with the answer. */
  ask: (question: string) => Promise<string>;
}

export function defaultWebhookDeps(): WebhookDeps {
  return {
    configPath: configPath(),
    keys: defaultKeyProvider(join(configDir(), 'key')),
    out: (line) => process.stdout.write(`${line}\n`),
    info: (line) => process.stderr.write(`${line}\n`),
    isInteractive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
    ask: async (question) => {
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      try {
        return await rl.question(question);
      } finally {
        rl.close();
      }
    },
  };
}

async function loadSession(profileFlag: string | undefined, deps: WebhookDeps): Promise<Session> {
  const config = await loadConfig(deps.configPath);
  return resolveSession(config, resolveProfileName(config, profileFlag), deps.keys);
}

function formatTable(header: string[], rows: string[][]): string[] {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => c.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

export interface WebhookListOptions {
  profile?: string;
  project?: string;
}

export async function webhookList(options: WebhookListOptions, deps: WebhookDeps): Promise<void> {
  const session = await loadSession(options.profile, deps);
  const webhooks = await listInboundWebhooks(session, options.project);
  if (webhooks.length === 0) {
    deps.out(options.project ? `No inbound webhooks in project ${options.project}.` : 'No inbound webhooks.');
    return;
  }
  const rows = webhooks.map((w: InboundWebhook) => [
    w.id,
    w.name,
    w.slug,
    w.projectId,
    w.isActive ? 'active' : 'inactive',
    String(w.submissionCount),
  ]);
  for (const line of formatTable(['ID', 'NAME', 'SLUG', 'PROJECT', 'STATUS', 'SUBMISSIONS'], rows)) deps.out(line);
}

export interface WebhookGetOptions {
  profile?: string;
  schemaOnly?: boolean;
  json?: boolean;
}

const yesNo = (value: boolean) => (value ? 'yes' : 'no');

function describeWebhook(w: InboundWebhook): string[] {
  return [
    `Name:                   ${w.name}`,
    `ID:                     ${w.id}`,
    `Slug:                   ${w.slug}`,
    `Project:                ${w.projectId}`,
    `Status:                 ${w.isActive ? 'active' : 'inactive'}`,
    `Require signature:      ${yesNo(w.requireSignature)}`,
    `Reject unknown fields:  ${yesNo(w.rejectUnknownFields)}`,
    `Allow role inheritance: ${yesNo(w.allowRoleInheritance)}`,
    `Accepted origins:       ${w.acceptedOrigins.length > 0 ? w.acceptedOrigins.join(', ') : '(any)'}`,
    `Submissions:            ${w.submissionCount}`,
    `Last submission:        ${w.lastSubmissionAt ?? 'never'}`,
    `Created:                ${w.createdAt}`,
    `Updated:                ${w.updatedAt}`,
    'Schema:',
    ...JSON.stringify(w.schema, null, 2)
      .split('\n')
      .map((line) => `  ${line}`),
  ];
}

export async function webhookGet(id: string, options: WebhookGetOptions, deps: WebhookDeps): Promise<void> {
  const session = await loadSession(options.profile, deps);
  const webhook = await getInboundWebhook(session, id);
  const data = options.schemaOnly ? webhook.schema : webhook;
  if (options.json) {
    // PRD §11 envelope.
    deps.out(JSON.stringify({ ok: true, data, source: 'mcdi' }, null, 2));
  } else if (options.schemaOnly) {
    deps.out(JSON.stringify(data, null, 2));
  } else {
    for (const line of describeWebhook(webhook)) deps.out(line);
  }
}

export interface WebhookUpdateOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
  schema?: string;
  name?: string;
  active?: boolean;
  inactive?: boolean;
}

/** Argument checks that must pass before any config read or network call. */
function buildPatch(options: WebhookUpdateOptions): InboundWebhookPatch {
  if (options.active && options.inactive) {
    throw new CliError('--active and --inactive cannot be used together', ExitCode.PrecheckFailed);
  }
  if (options.schema !== undefined) {
    throw new CliError(
      '--schema needs the local pre-check from issue #5, which is not implemented yet; nothing was sent',
      ExitCode.Unexpected,
    );
  }
  const patch: InboundWebhookPatch = {};
  if (options.name !== undefined) patch.name = options.name;
  if (options.active) patch.isActive = true;
  if (options.inactive) patch.isActive = false;
  if (Object.keys(patch).length === 0) {
    throw new CliError('nothing to update; pass --name, --active, or --inactive', ExitCode.PrecheckFailed);
  }
  return patch;
}

export async function webhookUpdate(id: string, options: WebhookUpdateOptions, deps: WebhookDeps): Promise<void> {
  const patch = buildPatch(options);
  const session = await loadSession(options.profile, deps);
  const webhook = await updateInboundWebhook(session, id, patch);
  deps.out(`Updated ${webhook.name} (${webhook.id}) on ${session.profileName}; now ${webhook.isActive ? 'active' : 'inactive'}`);
}

export interface WebhookRolesSetOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
  roles: string;
}

export async function webhookRolesSet(id: string, options: WebhookRolesSetOptions, deps: WebhookDeps): Promise<void> {
  const roleIds = options.roles
    .split(',')
    .map((role) => role.trim())
    .filter((role) => role !== '');
  // MCDI treats an empty set as removing all read access, not "allow everyone", so refuse it here first.
  if (roleIds.length === 0) {
    throw new CliError(
      '--roles needs at least one Discord role id; an empty set would remove all read access (delete the webhook instead)',
      ExitCode.PrecheckFailed,
    );
  }
  const session = await loadSession(options.profile, deps);
  const stored = await setInboundWebhookRoles(session, id, roleIds);
  deps.out(`Allowed reader roles for ${id} on ${session.profileName}: ${stored.join(', ')}`);
}

export interface WebhookSecretGetOptions {
  profile?: string;
  reveal?: boolean;
}

/** Shows only the last 4 characters, so the secret can be recognised but not used. */
function maskSecret(secret: string): string {
  return secret.length > 8 ? `${'*'.repeat(8)}${secret.slice(-4)}` : '*'.repeat(8);
}

export async function webhookSecretGet(options: WebhookSecretGetOptions, deps: WebhookDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profileName = resolveProfileName(config, options.profile);
  const stored = Object.entries(config.profiles[profileName]?.webhookSecrets ?? {});
  if (stored.length === 0) {
    throw new CliError(
      `no signing secret is stored locally for profile "${profileName}"; ` +
        `MCDI never re-issues one, so run \`m-forge webhook rotate-secret <id> --profile ${profileName}\` to get a new one`,
      ExitCode.NotFound,
    );
  }

  let picked = stored[0]!;
  if (stored.length > 1) {
    if (!deps.isInteractive) {
      throw new CliError(
        `${stored.length} signing secrets are stored for profile "${profileName}" and there is no interactive terminal to pick one`,
        ExitCode.PrecheckFailed,
      );
    }
    deps.info(`Signing secrets stored for profile "${profileName}":`);
    stored.forEach(([, entry], i) => deps.info(`  ${i + 1}) ${entry.name} (${entry.slug})`));
    const answer = (await deps.ask(`Pick one [1-${stored.length}]: `)).trim();
    const choice = /^\d+$/.test(answer) ? stored[Number(answer) - 1] : undefined;
    if (!choice) throw new CliError(`"${answer}" is not one of 1-${stored.length}`, ExitCode.PrecheckFailed);
    picked = choice;
  }

  const [, entry] = picked;
  let secret: string;
  try {
    secret = await decrypt(entry.secret, deps.keys);
  } catch {
    throw new CliError(`could not decrypt the stored signing secret for ${entry.name} (${entry.slug})`, ExitCode.Unexpected);
  }
  if (options.reveal) {
    // Alone on stdout so it can be piped straight into an env file.
    deps.info(`Signing secret for ${entry.name} (${entry.slug}):`);
    deps.out(secret);
  } else {
    deps.out(`Signing secret for ${entry.name} (${entry.slug}): ${maskSecret(secret)}`);
    deps.info('Pass --reveal to print it in plain text.');
  }
}
