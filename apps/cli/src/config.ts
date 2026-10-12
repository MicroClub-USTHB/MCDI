import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { CliError, ExitCode } from './errors.js';

/** Config file shape (PRD §6.2). Tokens in `session` are always encrypted. */
export interface StoredSession {
  accessToken: string;
  expiresAt: string;
  adminIdentity: string;
}

/**
 * A webhook signing secret mcdi-cli keeps because MCDI never re-issues one
 * (docs/endpoints/webhook/). `secret` is always encrypted, like `accessToken`;
 * the rest only labels it for `mcdi-cli webhook secret get`.
 */
export interface StoredWebhookSecret {
  secret: string;
  name: string;
  slug: string;
}

export interface Profile {
  baseUrl: string;
  session: StoredSession | null;
  /** Keyed by webhook id. */
  webhookSecrets?: Record<string, StoredWebhookSecret>;
}

export interface Config {
  version: 1;
  activeProfile: string | null;
  profiles: Record<string, Profile>;
}

export const DEFAULT_PROFILE = 'default';

/** PRD §5.2: a profile name is a bare identifier, never part of a URL or shell-escaped. */
export const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_PATTERN.test(name);
}

/** Where mcdi-cli keeps its state: the config file's directory, so `MCDI_CLI_CONFIG_PATH` moves the key file and global rules too. */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.MCDI_CLI_CONFIG_PATH
    ? dirname(env.MCDI_CLI_CONFIG_PATH)
    : join(homedir(), '.mcdi-cli');
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.MCDI_CLI_CONFIG_PATH || join(configDir(env), 'config.json');
}

export function emptyConfig(): Config {
  return { version: 1, activeProfile: null, profiles: {} };
}

export async function loadConfig(path = configPath()): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyConfig();
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError(`config file ${path} is not valid JSON`, ExitCode.Unexpected);
  }
  const config = parsed as Partial<Config> | null;
  if (
    !config ||
    config.version !== 1 ||
    typeof config.profiles !== 'object' ||
    config.profiles === null
  ) {
    throw new CliError(
      `config file ${path} has an unsupported shape (expected version 1)`,
      ExitCode.Unexpected,
    );
  }
  return { version: 1, activeProfile: config.activeProfile ?? null, profiles: config.profiles };
}

/** Writes atomically (temp file + rename) with mode 0600 so a crash never leaves a half-written config. */
export async function saveConfig(config: Config, path = configPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}

/** `--profile` wins, then the active profile, then "default". */
export function resolveProfileName(config: Config, flag: string | undefined): string {
  return flag ?? config.activeProfile ?? DEFAULT_PROFILE;
}

/** `--base-url` wins, then whatever the profile already has; there is no built-in default. */
export function resolveBaseUrl(
  config: Config,
  profileName: string,
  flag: string | undefined,
): string {
  const raw = flag ?? config.profiles[profileName]?.baseUrl;
  if (!raw) {
    throw new CliError(
      `profile "${profileName}" has no base URL yet; pass --base-url <url> (e.g. https://mcdi.example.com)`,
      ExitCode.Unexpected,
    );
  }
  return normalizeBaseUrl(raw);
}

/** Hosts that never leave this machine, the only ones a session token may reach over plain http. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Validates an MCDI base URL. The admin session token is sent to it, so it
 * must be https, except for a local MCDI on a loopback address.
 */
export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError(`invalid base URL "${raw}"`, ExitCode.Unexpected);
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new CliError(
      `base URL must be https (http is only allowed for localhost), got "${raw}"`,
      ExitCode.Unexpected,
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CliError(
      `base URL must not contain credentials, a query or a fragment, got "${raw}"`,
      ExitCode.Unexpected,
    );
  }
  return url.toString().replace(/\/+$/, '');
}

/**
 * Stores a session on a profile (creating it if needed) and makes it active if none is.
 * Keeps the profile's other fields: its webhook secrets can't be recovered from MCDI if lost.
 */
export function setSession(
  config: Config,
  profileName: string,
  baseUrl: string,
  session: StoredSession,
): Config {
  return {
    ...config,
    activeProfile: config.activeProfile ?? profileName,
    profiles: {
      ...config.profiles,
      [profileName]: { ...config.profiles[profileName], baseUrl, session },
    },
  };
}

/** Stores (or replaces) a webhook's encrypted signing secret on a profile that already exists. */
export function setWebhookSecret(
  config: Config,
  profileName: string,
  webhookId: string,
  entry: StoredWebhookSecret,
): Config {
  const profile = config.profiles[profileName];
  if (!profile) throw new CliError(`profile "${profileName}" does not exist`, ExitCode.Unexpected);
  return {
    ...config,
    profiles: {
      ...config.profiles,
      [profileName]: {
        ...profile,
        webhookSecrets: { ...profile.webhookSecrets, [webhookId]: entry },
      },
    },
  };
}

/** Drops a webhook's stored signing secret; returns null when there was none to drop. */
export function removeWebhookSecret(
  config: Config,
  profileName: string,
  webhookId: string,
): Config | null {
  const profile = config.profiles[profileName];
  if (!profile?.webhookSecrets || !(webhookId in profile.webhookSecrets)) return null;
  const webhookSecrets = { ...profile.webhookSecrets };
  delete webhookSecrets[webhookId];
  return {
    ...config,
    profiles: { ...config.profiles, [profileName]: { ...profile, webhookSecrets } },
  };
}

/**
 * Adds a new profile with no session, becoming the active profile only if
 * none is active yet (same rule as `setSession`'s first-login case). Refuses
 * an invalid name or one that already exists, before anything is saved.
 */
export function addProfile(config: Config, name: string, baseUrl: string): Config {
  if (!isValidProfileName(name)) {
    throw new CliError(
      `invalid profile name "${name}"; use only letters, digits, "_" or "-" (1-64 characters)`,
      ExitCode.PrecheckFailed,
    );
  }
  if (config.profiles[name]) {
    throw new CliError(`profile "${name}" already exists`, ExitCode.PrecheckFailed);
  }
  return {
    ...config,
    activeProfile: config.activeProfile ?? name,
    profiles: { ...config.profiles, [name]: { baseUrl, session: null } },
  };
}

/** Sets the active profile. Throws the same "no profile named" error `resolveSession` callers rely on when it doesn't exist. */
export function setActiveProfile(config: Config, name: string): Config {
  if (!config.profiles[name]) {
    throw new CliError(`no profile named "${name}"`, ExitCode.Auth);
  }
  return { ...config, activeProfile: name };
}

/**
 * Removes a profile unconditionally — callers that need to refuse while a
 * session or webhook secrets are still present (PRD §5.2, `mcdi-cli profile
 * remove`) must check that before calling this. Nulls `activeProfile` when
 * the removed profile was active; other profiles are untouched.
 */
export function removeProfile(config: Config, name: string): Config {
  if (!config.profiles[name]) {
    throw new CliError(`no profile named "${name}"`, ExitCode.Auth);
  }
  const profiles = { ...config.profiles };
  delete profiles[name];
  return {
    ...config,
    activeProfile: config.activeProfile === name ? null : config.activeProfile,
    profiles,
  };
}

/** Clears a profile's session (e.g. on logout), keeping its baseUrl, the other profiles, and activeProfile untouched. */
export function clearSession(config: Config, profileName: string): Config {
  const profile = config.profiles[profileName];
  if (!profile) return config;
  return {
    ...config,
    profiles: { ...config.profiles, [profileName]: { ...profile, session: null } },
  };
}
