import type { Config } from './config.js';
import { decrypt, sessionContext, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';

/** A profile's resolved, decrypted session — what any command that talks to MCDI needs. */
export interface Session {
  profileName: string;
  baseUrl: string;
  token: string;
}

/**
 * Looks up and decrypts the stored session for a profile. Throws a
 * CliError(Auth) with a `mcdi-cli login` hint whenever there's nothing usable
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
      `not logged in on profile "${profileName}"; run \`mcdi-cli login --profile ${profileName}\``,
      ExitCode.Auth,
    );
  }
  let token: string;
  try {
    token = await decrypt(profile.session.accessToken, keys, sessionContext(profileName));
  } catch {
    throw new CliError(
      `could not decrypt the stored session for profile "${profileName}"; run \`mcdi-cli login --profile ${profileName}\` again`,
      ExitCode.Auth,
    );
  }
  return { profileName, baseUrl: profile.baseUrl, token };
}
