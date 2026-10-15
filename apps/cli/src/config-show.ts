import { configPath, loadConfig, resolveProfileName, type Profile } from './config.js';
import { CliError, ExitCode } from './errors.js';

export interface ConfigDeps {
  configPath: string;
  /** Results (stdout, so they stay pipeable/scriptable). */
  out: (line: string) => void;
}

export function defaultConfigDeps(): ConfigDeps {
  return {
    configPath: configPath(),
    out: (line) => process.stdout.write(`${line}\n`),
  };
}

/** Prints the resolved config file location (PRD §6.1), even if nothing has been written there yet. Never creates it. */
export function configShowPath(deps: ConfigDeps): void {
  deps.out(deps.configPath);
}

const REDACTED = '<encrypted>';

/**
 * Replaces every value that's encrypted at rest with a fixed marker. Never
 * decrypts (CLAUDE.md: secrets never reach output) — only reconstructs the same
 * shape with `accessToken` and each webhook secret's `secret` swapped out.
 */
export function redactProfile(profile: Profile): Record<string, unknown> {
  const redacted: Record<string, unknown> = {
    ...profile,
    session: profile.session ? { ...profile.session, accessToken: REDACTED } : null,
  };
  if (profile.webhookSecrets) {
    redacted.webhookSecrets = Object.fromEntries(
      Object.entries(profile.webhookSecrets).map(([id, entry]) => [
        id,
        { ...entry, secret: REDACTED },
      ]),
    );
  }
  return redacted;
}

export interface ConfigShowOptions {
  profile?: string;
}

/** Offline (PRD §6.1): reads the config file only, never writes it, never decrypts a secret. */
export async function configShow(options: ConfigShowOptions, deps: ConfigDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const name = resolveProfileName(config, options.profile);
  const profile = config.profiles[name];
  if (!profile) {
    throw new CliError(`no profile named "${name}"`, ExitCode.NotFound);
  }
  const data = { name, active: config.activeProfile === name, ...redactProfile(profile) };
  deps.out(JSON.stringify(data, null, 2));
}
