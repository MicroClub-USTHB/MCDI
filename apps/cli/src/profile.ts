import { createInterface } from 'node:readline/promises';
import {
  addProfile,
  configPath,
  loadConfig,
  normalizeBaseUrl,
  type Profile,
  removeProfile,
  setActiveProfile,
  updateConfig,
} from './config.js';
import { CliError, ExitCode } from './errors.js';
import { formatTable } from './webhook-flow.js';

export interface ProfileDeps {
  configPath: string;
  /** Results (stdout, so they stay pipeable/scriptable). */
  out: (line: string) => void;
  /** Prompts and hints (stderr, PRD §11). */
  info: (line: string) => void;
  /** Whether a human can answer a prompt; when false, nothing may block on input. */
  isInteractive: boolean;
  /** Asks a question on stderr and resolves with the answer. */
  ask: (question: string) => Promise<string>;
  /** Clock, overridable in tests; defaults to `new Date()`. */
  now?: () => Date;
}

export function defaultProfileDeps(): ProfileDeps {
  return {
    configPath: configPath(),
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

/** Session state for `profile list`; never decrypts, only reads the plaintext `adminIdentity`/`expiresAt` fields. */
function describeSession(profile: Profile, now: Date): string {
  if (!profile.session) return 'not logged in';
  if (new Date(profile.session.expiresAt).getTime() <= now.getTime()) return 'expired';
  return `logged in as ${profile.session.adminIdentity} until ${profile.session.expiresAt}`;
}

function secretCount(profile: Profile): number {
  return Object.keys(profile.webhookSecrets ?? {}).length;
}

/** Offline (PRD §5.2): reads the config file only, no network call. */
export async function profileList(deps: ProfileDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const names = Object.keys(config.profiles);
  if (names.length === 0) {
    deps.out(
      'No profiles configured; run `mcdi-cli profile add <name> --base-url <url>` or `mcdi-cli login`.',
    );
    return;
  }
  const now = (deps.now ?? (() => new Date()))();
  const rows = names.map((name) => {
    const profile = config.profiles[name]!;
    return [
      name === config.activeProfile ? '*' : '',
      name,
      profile.baseUrl,
      describeSession(profile, now),
      String(secretCount(profile)),
    ];
  });
  for (const line of formatTable(['', 'NAME', 'BASE URL', 'SESSION', 'SECRETS'], rows))
    deps.out(line);
}

export interface ProfileAddOptions {
  baseUrl: string;
}

export async function profileAdd(
  name: string,
  options: ProfileAddOptions,
  deps: ProfileDeps,
): Promise<void> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const updated = await updateConfig(deps.configPath, (config) =>
    addProfile(config, name, baseUrl),
  );
  const active = updated.activeProfile === name;
  deps.out(`Added profile "${name}" (${baseUrl})${active ? '; it is now the active profile' : ''}`);
}

export async function profileUse(name: string, deps: ProfileDeps): Promise<void> {
  const updated = await updateConfig(deps.configPath, (config) => setActiveProfile(config, name));
  deps.out(`Active profile is now "${name}" (${updated.profiles[name]!.baseUrl})`);
}

export interface ProfileRemoveOptions {
  yes?: boolean;
}

export async function profileRemove(
  name: string,
  options: ProfileRemoveOptions,
  deps: ProfileDeps,
): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profile = config.profiles[name];
  if (!profile) {
    throw new CliError(`no profile named "${name}"`, ExitCode.NotFound);
  }

  if (profile.session) {
    throw new CliError(
      `profile "${name}" is still logged in; run \`mcdi-cli logout --profile ${name}\` first`,
      ExitCode.PrecheckFailed,
    );
  }

  const secrets = secretCount(profile);
  if (secrets > 0 && !options.yes) {
    if (!deps.isInteractive) {
      throw new CliError(
        `profile "${name}" still holds ${secrets} webhook signing secret(s) that MCDI can never re-issue, and ` +
          'there is no interactive terminal to confirm; pass --yes to confirm',
        ExitCode.PrecheckFailed,
      );
    }
    deps.info(
      `Profile "${name}" still holds ${secrets} webhook signing secret(s). MCDI never re-issues a rotated secret, ` +
        `so removing this profile loses ${secrets === 1 ? 'it' : 'them'} forever.`,
    );
    const answer = (await deps.ask('Remove it? [y/N] ')).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes') {
      throw new CliError('aborted; nothing was removed', ExitCode.PrecheckFailed);
    }
  }

  const wasActive = config.activeProfile === name;
  await updateConfig(deps.configPath, (latest) => removeProfile(latest, name));
  deps.out(`Removed profile "${name}"${wasActive ? '; active profile is now unset' : ''}`);
}
