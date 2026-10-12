import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import {
  configDir,
  configPath,
  loadConfig,
  removeWebhookSecret,
  resolveProfileName,
  saveConfig,
  setWebhookSecret,
} from './config.js';
import { readFile } from 'node:fs/promises';
import { decrypt, defaultKeyProvider, encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import {
  createInboundWebhook,
  deleteInboundWebhook,
  getInboundWebhook,
  listInboundWebhooks,
  listProjects,
  rotateInboundWebhookSecret,
  setInboundWebhookRoles,
  updateInboundWebhook,
  type InboundWebhook,
  type CreateInboundWebhookBody,
  type InboundWebhookPatch,
} from './mcdi.js';
import { precheckSchema } from './schema/custom-rules.js';
import { defaultRuleLocations, loadCustomRules, type CustomRule } from './schema/rules.js';
import type { ValidationError } from './schema/validate.js';
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
  /** Custom validation rules (#6) for the schema pre-check; none when omitted. */
  loadRules?: () => Promise<readonly CustomRule[]>;
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
    loadRules: () => loadCustomRules(defaultRuleLocations()),
  };
}

async function loadSession(profileFlag: string | undefined, deps: WebhookDeps): Promise<Session> {
  const config = await loadConfig(deps.configPath);
  return resolveSession(config, resolveProfileName(config, profileFlag), deps.keys);
}

/** An aligned, two-space-separated text table (header first). */
export function formatTable(header: string[], rows: string[][]): string[] {
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
    deps.out(
      options.project
        ? `No inbound webhooks in project ${options.project}.`
        : 'No inbound webhooks.',
    );
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
  for (const line of formatTable(['ID', 'NAME', 'SLUG', 'PROJECT', 'STATUS', 'SUBMISSIONS'], rows))
    deps.out(line);
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

export async function webhookGet(
  id: string,
  options: WebhookGetOptions,
  deps: WebhookDeps,
): Promise<void> {
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

/** Argument checks that must pass before any file read, config read, or network call. */
function checkUpdateFlags(options: WebhookUpdateOptions): void {
  if (options.active && options.inactive) {
    throw new CliError('--active and --inactive cannot be used together', ExitCode.PrecheckFailed);
  }
  if (
    options.schema === undefined &&
    options.name === undefined &&
    !options.active &&
    !options.inactive
  ) {
    throw new CliError(
      'nothing to update; pass --schema, --name, --active, or --inactive',
      ExitCode.PrecheckFailed,
    );
  }
}

export async function webhookUpdate(
  id: string,
  options: WebhookUpdateOptions,
  deps: WebhookDeps,
): Promise<void> {
  checkUpdateFlags(options);
  const patch: InboundWebhookPatch = {};
  if (options.name !== undefined) patch.name = options.name;
  if (options.schema !== undefined) patch.schema = await readCheckedSchema(options.schema, deps);
  if (options.active) patch.isActive = true;
  if (options.inactive) patch.isActive = false;

  const session = await loadSession(options.profile, deps);
  const webhook = await updateInboundWebhook(session, id, patch);
  deps.out(
    `Updated ${webhook.name} (${webhook.id}) on ${session.profileName}; now ${webhook.isActive ? 'active' : 'inactive'}`,
  );
}

export interface WebhookRolesSetOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
  roles: string;
}

/**
 * Splits a comma-separated `--roles` value. MCDI treats an empty allowed-readers
 * set as nobody, not "allow everyone", so an empty one is refused before any call.
 */
function parseRoleIds(raw: string, emptyMeans: string): string[] {
  const roleIds = raw
    .split(',')
    .map((role) => role.trim())
    .filter((role) => role !== '');
  if (roleIds.length === 0) {
    throw new CliError(
      `--roles needs at least one Discord role id; ${emptyMeans}`,
      ExitCode.PrecheckFailed,
    );
  }
  return roleIds;
}

export async function webhookRolesSet(
  id: string,
  options: WebhookRolesSetOptions,
  deps: WebhookDeps,
): Promise<void> {
  const roleIds = parseRoleIds(
    options.roles,
    'an empty set would remove all read access (delete the webhook instead)',
  );
  const session = await loadSession(options.profile, deps);
  const stored = await setInboundWebhookRoles(session, id, roleIds);
  deps.out(`Allowed reader roles for ${id} on ${session.profileName}: ${stored.join(', ')}`);
}

export interface WebhookSecretGetOptions {
  profile?: string;
  reveal?: boolean;
}

/** Shows only the last 4 characters, so the secret can be recognised but not used. */
export function maskSecret(secret: string): string {
  return secret.length > 8 ? `${'*'.repeat(8)}${secret.slice(-4)}` : '*'.repeat(8);
}

export async function webhookSecretGet(
  options: WebhookSecretGetOptions,
  deps: WebhookDeps,
): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profileName = resolveProfileName(config, options.profile);
  const stored = Object.entries(config.profiles[profileName]?.webhookSecrets ?? {});
  if (stored.length === 0) {
    throw new CliError(
      `no signing secret is stored locally for profile "${profileName}"; ` +
        `MCDI never re-issues one, so run \`mcdi-cli webhook rotate-secret <id> --profile ${profileName}\` to get a new one`,
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
    if (!choice)
      throw new CliError(`"${answer}" is not one of 1-${stored.length}`, ExitCode.PrecheckFailed);
    picked = choice;
  }

  const [, entry] = picked;
  let secret: string;
  try {
    secret = await decrypt(entry.secret, deps.keys);
  } catch {
    throw new CliError(
      `could not decrypt the stored signing secret for ${entry.name} (${entry.slug})`,
      ExitCode.Unexpected,
    );
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

export interface WebhookCreateOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
  name: string;
  /** Omitted → prompted for interactively from `GET /admin/projects` (requires a TTY). */
  project?: string;
  /** Omitted → MCDI falls back to the project's configured default reader roles. */
  roles?: string;
  acceptOrigin: string[];
  slug?: string;
  reveal?: boolean;
}

/** MCDI's `CreateInboundWebhookDto.slug` rule. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

/** "Recruitment 2026!" → "recruitment-2026"; may still fail SLUG_PATTERN (e.g. a one-character name). */
export function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

function resolveSlug(options: WebhookCreateOptions): string {
  const slug = options.slug ?? slugFromName(options.name);
  if (SLUG_PATTERN.test(slug)) return slug;
  throw new CliError(
    options.slug !== undefined
      ? `--slug "${slug}" must be 2-64 lowercase letters, digits, or dashes, not starting or ending with a dash`
      : `could not derive a valid slug from --name "${options.name}"; pass --slug <slug>`,
    ExitCode.PrecheckFailed,
  );
}

/** Same layout as `mcdi-cli schema validate`. */
function formatLocalErrors(errors: Pick<ValidationError, 'path' | 'code' | 'message'>[]): string {
  const noun = errors.length === 1 ? 'error' : 'errors';
  return [
    `✗ ${errors.length} validation ${noun} (source: local); nothing was sent`,
    ...errors.map((e) => `  ${e.path}  ${e.code}  ${e.message}`),
  ].join('\n');
}

/** Reads a schema file and runs the local pre-check (#5 built-ins + #6 custom rules); any failure stops before a network call. */
async function readCheckedSchema(
  path: string,
  deps: WebhookDeps,
): Promise<Record<string, unknown>> {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(`could not read schema ${path}: ${reason}`, ExitCode.Unexpected);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(
      formatLocalErrors([{ path, code: 'INVALID_JSON', message: reason }]),
      ExitCode.PrecheckFailed,
    );
  }
  const rules = deps.loadRules ? await deps.loadRules() : [];
  const result = precheckSchema(parsed, rules);
  if (!result.valid) throw new CliError(formatLocalErrors(result.errors), ExitCode.PrecheckFailed);
  return parsed as Record<string, unknown>;
}

/** Prompts for a project when `--project` was omitted; requires a TTY (PRD §11). */
async function resolveProjectId(
  session: Session,
  options: WebhookCreateOptions,
  deps: WebhookDeps,
): Promise<string> {
  if (options.project) return options.project;
  if (!deps.isInteractive) {
    throw new CliError(
      'no interactive terminal to pick a project; pass --project <projectId>',
      ExitCode.PrecheckFailed,
    );
  }
  const projects = await listProjects(session);
  if (projects.length === 0) {
    throw new CliError(
      'no projects are available to create a webhook on; pass --project <projectId>',
      ExitCode.NotFound,
    );
  }
  if (projects.length === 1) return projects[0]!.id;

  deps.info('Projects:');
  projects.forEach((p, i) => deps.info(`  ${i + 1}) ${p.name} (${p.id})`));
  const answer = (await deps.ask(`Pick one [1-${projects.length}]: `)).trim();
  const choice = /^\d+$/.test(answer) ? projects[Number(answer) - 1] : undefined;
  if (!choice)
    throw new CliError(`"${answer}" is not one of 1-${projects.length}`, ExitCode.PrecheckFailed);
  return choice.id;
}

export async function webhookCreate(
  schemaPath: string,
  options: WebhookCreateOptions,
  deps: WebhookDeps,
): Promise<void> {
  const allowedRoleIds =
    options.roles === undefined
      ? undefined
      : parseRoleIds(
          options.roles,
          "omit --roles to fall back to the project's default reader roles",
        );
  const slug = resolveSlug(options);
  const schema = await readCheckedSchema(schemaPath, deps);

  const session = await loadSession(options.profile, deps);
  const projectId = await resolveProjectId(session, options, deps);
  const body: CreateInboundWebhookBody = { projectId, name: options.name, slug, schema };
  if (allowedRoleIds !== undefined) body.allowedRoleIds = allowedRoleIds;
  if (options.acceptOrigin.length > 0) body.acceptedOrigins = options.acceptOrigin;
  const created = await createInboundWebhook(session, body);
  const { webhook } = created;

  // MCDI will never show this secret again, so it has to land in the local store now.
  try {
    const latest = await loadConfig(deps.configPath);
    const entry = {
      secret: await encrypt(created.signingSecret, deps.keys),
      name: webhook.name,
      slug: webhook.slug,
    };
    await saveConfig(
      setWebhookSecret(latest, session.profileName, webhook.id, entry),
      deps.configPath,
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(
      `webhook ${webhook.name} (${webhook.id}) was created on MCDI, but its signing secret could not be stored locally ` +
        `(${reason}); run \`mcdi-cli webhook rotate-secret ${webhook.id} --profile ${session.profileName}\` to get a new one`,
      ExitCode.Unexpected,
    );
  }

  deps.out(`Created ${webhook.name} (${webhook.slug}) on ${session.profileName}`);
  deps.out(`ID:             ${webhook.id}`);
  deps.out(`Submit URL:     ${created.submitUrl}`);
  deps.out(`Docs:           ${created.docsUrl}`);
  deps.out(
    `Allowed roles:  ${created.allowedRoleIds.join(', ')}` +
      (allowedRoleIds === undefined ? ' (project default)' : ''),
  );
  deps.out(
    `Signing secret: ${options.reveal ? created.signingSecret : maskSecret(created.signingSecret)}`,
  );
  deps.info(
    `The signing secret is stored encrypted; get it again with \`mcdi-cli webhook secret get --profile ${session.profileName}\`` +
      (options.reveal ? '.' : ' (pass --reveal to print it in plain text).'),
  );
}

export interface WebhookDeleteOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
  yes?: boolean;
}

export async function webhookDelete(
  id: string,
  options: WebhookDeleteOptions,
  deps: WebhookDeps,
): Promise<void> {
  const session = await loadSession(options.profile, deps);

  if (!options.yes) {
    if (!deps.isInteractive) {
      throw new CliError(
        'refusing to delete without confirmation and there is no interactive terminal to ask; pass --yes to confirm',
        ExitCode.PrecheckFailed,
      );
    }
    deps.info(
      `This permanently deletes inbound webhook ${id} on ${session.profileName} AND ALL OF ITS SUBMISSIONS.`,
    );
    deps.info('There is no undo.');
    const answer = (await deps.ask('Delete it? [y/N] ')).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes')
      throw new CliError('aborted; nothing was deleted', ExitCode.PrecheckFailed);
  }

  await deleteInboundWebhook(session, id);

  // Only now that MCDI confirmed the deletion: a secret for a webhook that no longer exists is useless.
  let removedSecret = false;
  try {
    const latest = await loadConfig(deps.configPath);
    const updated = removeWebhookSecret(latest, session.profileName, id);
    if (updated) {
      await saveConfig(updated, deps.configPath);
      removedSecret = true;
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(
      `webhook ${id} was deleted on MCDI, but its locally stored signing secret could not be removed (${reason})`,
      ExitCode.Unexpected,
    );
  }
  deps.out(
    `Deleted inbound webhook ${id} on ${session.profileName}` +
      (removedSecret ? '; removed its locally stored signing secret' : ''),
  );
}

export interface WebhookRotateSecretOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
  reveal?: boolean;
  yes?: boolean;
}

export async function webhookRotateSecret(
  id: string,
  options: WebhookRotateSecretOptions,
  deps: WebhookDeps,
): Promise<void> {
  const session = await loadSession(options.profile, deps);

  // Asked before any network call, like delete, so the confirmation is testable without a server.
  if (!options.yes) {
    if (!deps.isInteractive) {
      throw new CliError(
        'refusing to rotate without confirmation and there is no interactive terminal to ask; pass --yes to confirm',
        ExitCode.PrecheckFailed,
      );
    }
    deps.info(
      `Rotating the signing secret for inbound webhook ${id} on ${session.profileName} immediately breaks every ` +
        'integration still signing with the current secret.',
    );
    const answer = (await deps.ask('Rotate it? [y/N] ')).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes')
      throw new CliError('aborted; nothing was rotated', ExitCode.PrecheckFailed);
  }

  // Fetched first so a 404 (unknown id) exits before anything is rotated, and so the
  // name/slug are available for the local store without MCDI having to echo them back.
  const webhook = await getInboundWebhook(session, id);
  const signingSecret = await rotateInboundWebhookSecret(session, id);

  // MCDI never shows this secret again, so it has to land in the local store now.
  try {
    const latest = await loadConfig(deps.configPath);
    const entry = {
      secret: await encrypt(signingSecret, deps.keys),
      name: webhook.name,
      slug: webhook.slug,
    };
    await saveConfig(
      setWebhookSecret(latest, session.profileName, webhook.id, entry),
      deps.configPath,
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(
      `the signing secret for ${webhook.name} (${webhook.id}) was rotated on MCDI, but could not be stored locally ` +
        `(${reason}); the old secret no longer works; run \`mcdi-cli webhook rotate-secret ${webhook.id} --profile ${session.profileName}\` ` +
        'again to get a new one',
      ExitCode.Unexpected,
    );
  }

  deps.out(
    `Rotated the signing secret for ${webhook.name} (${webhook.slug}) on ${session.profileName}`,
  );
  deps.out(`Signing secret: ${options.reveal ? signingSecret : maskSecret(signingSecret)}`);
  deps.info(
    `The signing secret is stored encrypted; get it again with \`mcdi-cli webhook secret get --profile ${session.profileName}\`` +
      (options.reveal ? '.' : ' (pass --reveal to print it in plain text).'),
  );
}
