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

export interface Profile {
  baseUrl: string;
  session: StoredSession | null;
}

export interface Config {
  version: 1;
  activeProfile: string | null;
  profiles: Record<string, Profile>;
}

export const DEFAULT_PROFILE = 'default';

export function configDir(): string {
  return join(homedir(), '.m-forge');
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.MFORGE_CONFIG_PATH || join(configDir(), 'config.json');
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
  if (!config || config.version !== 1 || typeof config.profiles !== 'object' || config.profiles === null) {
    throw new CliError(`config file ${path} has an unsupported shape (expected version 1)`, ExitCode.Unexpected);
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
export function resolveBaseUrl(config: Config, profileName: string, flag: string | undefined): string {
  const raw = flag ?? config.profiles[profileName]?.baseUrl;
  if (!raw) {
    throw new CliError(
      `profile "${profileName}" has no base URL yet; pass --base-url <url> (e.g. https://mcdi.example.com)`,
      ExitCode.Unexpected,
    );
  }
  return normalizeBaseUrl(raw);
}

export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError(`invalid base URL "${raw}"`, ExitCode.Unexpected);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CliError(`base URL must be http(s), got "${raw}"`, ExitCode.Unexpected);
  }
  return url.toString().replace(/\/+$/, '');
}

/** Stores a session on a profile (creating it if needed) and makes it active if none is. */
export function setSession(config: Config, profileName: string, baseUrl: string, session: StoredSession): Config {
  return {
    ...config,
    activeProfile: config.activeProfile ?? profileName,
    profiles: { ...config.profiles, [profileName]: { baseUrl, session } },
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
