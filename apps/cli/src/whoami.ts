import { configPath, loadConfig, resolveProfileName } from './config.js';
import { defaultKeyProvider, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { adminDisplayName, getAdminMeRaw, parseAdminMe } from './mcid.js';
import { resolveSession } from './session.js';

export interface WhoamiOptions {
  profile?: string;
  json?: boolean;
}

export interface WhoamiDeps {
  configPath: string;
  keys: KeyProvider;
  /** The result (stdout, so it stays pipeable/scriptable). */
  out: (line: string) => void;
}

export function defaultWhoamiDeps(): WhoamiDeps {
  return {
    configPath: configPath(),
    keys: defaultKeyProvider(),
    out: (line) => process.stdout.write(`${line}\n`),
  };
}

/**
 * Read-only: resolves the profile's stored session and asks MCID who it
 * belongs to. Never writes the config file and never prints the token,
 * in either human or `--json` mode. There is no refresh endpoint for the
 * admin session (see the Admin API reference), so a 401 here is final — no retry.
 */
export async function whoami(options: WhoamiOptions, deps: WhoamiDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profileName = resolveProfileName(config, options.profile);
  const session = await resolveSession(config, profileName, deps.keys);

  const { status, body } = await getAdminMeRaw(session.baseUrl, session.token);
  if (status === 401) {
    throw new CliError(
      `session expired, run \`mcid-cli login --profile ${profileName}\``,
      ExitCode.Auth,
    );
  }
  if (status === 403) {
    throw new CliError(
      'this Discord account is not allowed to use the MCID admin API',
      ExitCode.Auth,
    );
  }

  if (options.json) {
    deps.out(JSON.stringify(body, null, 2));
    return;
  }

  const me = parseAdminMe(body);
  deps.out(`Logged in as ${adminDisplayName(me)} (${me.username}) on ${profileName}`);
  deps.out(`MCID: ${session.baseUrl}`);
  deps.out(`Session expires: ${me.sessionExpiresAt}`);
}
