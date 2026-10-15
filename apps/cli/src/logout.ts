import {
  clearSession,
  configPath,
  loadConfig,
  normalizeBaseUrl,
  resolveProfileName,
  updateConfig,
} from './config.js';
import {
  decrypt,
  defaultKeyProvider,
  KeyUnavailableError,
  sessionContext,
  type KeyProvider,
} from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { postAdminLogout } from './mcid.js';

export interface LogoutOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
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

/** Re-reads the config right before saving (like login does) so a change made while we waited on MCID isn't clobbered. */
async function clearLocally(path: string, profileName: string): Promise<void> {
  await updateConfig(path, (latest) => clearSession(latest, profileName));
}

/**
 * Calls MCID's logout endpoint with the stored session's bearer token, then
 * always drops the session from the local profile — a session that's
 * already expired, unrevokable, or unreachable server-side should still be
 * clearable locally (see the Admin API reference). Never prints the token.
 */
export async function logout(options: LogoutOptions, deps: LogoutDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profileName = resolveProfileName(config, options.profile);
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new CliError(`no profile named "${profileName}"`, ExitCode.NotFound);
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
        `revoked on MCID and may stay valid there until ${session.expiresAt}`,
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

  // Clear locally whatever MCID said, and before any server error propagates.
  await clearLocally(deps.configPath, profileName);

  if (serverError !== undefined) {
    const reason = serverError instanceof Error ? serverError.message : String(serverError);
    throw new CliError(
      `logged out of ${profileName} locally, but MCID could not revoke the session (${reason}); ` +
        `it may still be valid on MCID until ${session.expiresAt}`,
      ExitCode.Unexpected,
    );
  }

  deps.out(`Logged out of ${profileName}`);
  if (status === 401) {
    deps.out('(the session had already expired on MCID)');
  } else if (status === 403) {
    deps.warn(
      'warning: MCID refused the logout because this account may no longer use the admin API, so the session ' +
        "could not be revoked server-side (that session can't be used for admin actions either way)",
    );
  }
}
