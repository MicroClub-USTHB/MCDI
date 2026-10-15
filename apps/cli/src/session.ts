import { normalizeBaseUrl, type Config } from './config.js';
import { decrypt, KeyUnavailableError, sessionContext, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';

/** A profile's resolved, decrypted session — what any command that talks to MCID needs. */
export interface Session {
  profileName: string;
  baseUrl: string;
  token: string;
}

/**
 * Looks up and decrypts the stored session for a profile. Throws a
 * CliError(Auth) with a `mcid-cli login` hint whenever there's nothing usable
 * to act on, rather than letting callers each re-derive that message.
 */
export async function resolveSession(
  config: Config,
  profileName: string,
  keys: KeyProvider,
): Promise<Session> {
  const profile = config.profiles[profileName];
  if (!profile || !profile.session) {
    throw new CliError(
      `not logged in on profile "${profileName}"; run \`mcid-cli login --profile ${profileName}\``,
      ExitCode.Auth,
    );
  }
  let token: string;
  try {
    token = await decrypt(profile.session.accessToken, keys, sessionContext(profileName));
  } catch (err) {
    if (err instanceof KeyUnavailableError) throw new CliError(err.message, ExitCode.Auth);
    throw new CliError(
      `could not decrypt the stored session for profile "${profileName}"; run \`mcid-cli login --profile ${profileName}\` again`,
      ExitCode.Auth,
    );
  }
  // Re-checked here because the config file can be edited by hand.
  return { profileName, baseUrl: normalizeBaseUrl(profile.baseUrl), token };
}
