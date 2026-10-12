import {
  clearSession,
  configPath,
  loadConfig,
  normalizeBaseUrl,
  resolveProfileName,
  saveConfig,
} from './config.js';
import {
  decrypt,
  defaultKeyProvider,
  KeyUnavailableError,
  sessionContext,
  type KeyProvider,
} from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { postAdminLogout } from './mcdi.js';

export interface LogoutOptions {
  profile?: string;
}

export interface LogoutDeps {
  configPath: string;
  keys: KeyProvider;
  /** The result (stdout, so it stays pipeable/scriptable). */
  out: (line: string) => void;
  /** Warnings that don't belong in scriptable output (stderr). */
  warn: (line: string) => void;
}

export function defaultLogoutDeps(): LogoutDeps {
  return {
    configPath: configPath(),
    keys: defaultKeyProvider(),
    out: (line) => process.stdout.write(`${line}\n`),
    warn: (line) => process.stderr.write(`${line}\n`),
  };
}

/** Re-reads the config right before saving (like login does) so a change made while we waited on MCDI isn't clobbered. */
async function clearLocally(path: string, profileName: string): Promise<void> {
  const latest = await loadConfig(path);
  await saveConfig(clearSession(latest, profileName), path);
}

/**
 * Calls MCDI's logout endpoint with the stored session's bearer token, then
 * always drops the session from the local profile — a session that's
 * already expired, unrevokable, or unreachable server-side should still be
 * clearable locally (see the Admin API reference). Never prints the token.
 */
export async function logout(options: LogoutOptions, deps: LogoutDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profileName = resolveProfileName(config, options.profile);
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new CliError(`no profile named "${profileName}"`, ExitCode.Auth);
  }
  if (!profile.session) {
    deps.out(`Not logged in on ${profileName}, nothing to do`);
    return;
  }
  const { baseUrl, session } = profile;

  let token: string | undefined;
  try {
    token = await decrypt(session.accessToken, deps.keys, sessionContext(profileName));
  } catch (err) {
    // A locked keychain is temporary: keep the session so it can still be revoked.
    if (err instanceof KeyUnavailableError) throw new CliError(err.message, ExitCode.Auth);
    token = undefined;
  }

  if (token === undefined) {
    await clearLocally(deps.configPath, profileName);
    deps.out(`Logged out of ${profileName}`);
    deps.warn(
      `warning: the stored session for profile "${profileName}" could not be decrypted, so it could not be ` +
        `revoked on MCDI and may stay valid there until ${session.expiresAt}`,
    );
    return;
  }

  let status: number | undefined;
  let serverError: unknown;
  try {
    status = await postAdminLogout(normalizeBaseUrl(baseUrl), token);
  } catch (err) {
    serverError = err;
  }

  // Clear locally whatever MCDI said, and before any server error propagates.
  await clearLocally(deps.configPath, profileName);

  if (serverError !== undefined) {
    const reason = serverError instanceof Error ? serverError.message : String(serverError);
    throw new CliError(
      `logged out of ${profileName} locally, but MCDI could not revoke the session (${reason}); ` +
        `it may still be valid on MCDI until ${session.expiresAt}`,
      ExitCode.Unexpected,
    );
  }

  deps.out(`Logged out of ${profileName}`);
  if (status === 401) {
    deps.out('(the session had already expired on MCDI)');
  } else if (status === 403) {
    deps.warn(
      'warning: MCDI refused the logout because this account is no longer a system admin, so the session ' +
        "could not be revoked server-side (that session can't be used for admin actions either way)",
    );
  }
}
