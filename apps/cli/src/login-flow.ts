import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { openBrowser } from './browser.js';
import {
  configDir,
  configPath,
  loadConfig,
  resolveBaseUrl,
  resolveProfileName,
  saveConfig,
  setSession,
} from './config.js';
import { defaultKeyProvider, encrypt, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode } from './errors.js';
import { adminDisplayName, getAdminLoginUrl, getAdminMe } from './mcdi.js';

export const CALLBACK_PATH = '/callback';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface LoginOptions {
  profile?: string;
  baseUrl?: string;
}

export interface LoginDeps {
  configPath: string;
  keys: KeyProvider;
  openBrowser: (url: string) => Promise<boolean>;
  /** Progress and hints (stderr, so stdout stays pipeable). */
  info: (line: string) => void;
  /** The final result line (stdout). */
  out: (line: string) => void;
  timeoutMs: number;
}

export function defaultLoginDeps(): LoginDeps {
  return {
    configPath: configPath(),
    keys: defaultKeyProvider(join(configDir(), 'key')),
    openBrowser: (url) => openBrowser(url),
    info: (line) => process.stderr.write(`${line}\n`),
    out: (line) => process.stdout.write(`${line}\n`),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export type CallbackResult = { kind: 'token'; token: string } | { kind: 'error'; message: string } | { kind: 'ignore'; reason: string };

/**
 * Reads MCDI's redirect to the loopback listener. This is the only piece that
 * depends on the contract still open in issue #2; it currently expects
 * `?token=<session>&state=<state>` on success and `?error=<message>` on failure
 * (the same `error` param MCDI's admin callback already uses for the web panel).
 *
 * A token is only accepted alongside the exact `state` this login started with,
 * so another local process can't plant a session. An `error` is accepted without
 * it because the worst a forged one can do is abort this login.
 */
export function readCallback(params: URLSearchParams, expectedState: string): CallbackResult {
  const error = params.get('error');
  if (error) return { kind: 'error', message: error };
  if (params.get('state') !== expectedState) {
    return { kind: 'ignore', reason: 'state does not match this login attempt' };
  }
  const token = params.get('token');
  if (!token) return { kind: 'ignore', reason: 'callback is missing the session token' };
  return { kind: 'token', token };
}

/** Pulls the OAuth `state` MCDI generated out of the Discord URL, so the callback can be tied back to it. */
export function extractState(discordUrl: string): string {
  let url: URL;
  try {
    url = new URL(discordUrl);
  } catch {
    throw new CliError('MCDI returned an invalid Discord URL', ExitCode.Unexpected);
  }
  if (url.protocol !== 'https:') {
    throw new CliError(`refusing to open a non-https login URL from MCDI (${url.protocol})`, ExitCode.Unexpected);
  }
  const state = url.searchParams.get('state');
  if (!state) throw new CliError('MCDI login URL has no OAuth state parameter', ExitCode.Unexpected);
  return state;
}

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>mcdi-cli</title><h1>${title}</h1><p>${body}</p>`;

interface CallbackListener {
  redirectUri: string;
  /** Resolves with the session token, rejects on an MCDI error or timeout. */
  waitForToken(expectedState: string, timeoutMs: number): Promise<string>;
  close(): Promise<void>;
}

/** Starts a one-shot HTTP listener on 127.0.0.1 (never all interfaces) on an OS-chosen port. */
export async function startCallbackListener(warn: (line: string) => void): Promise<CallbackListener> {
  let onRequest: (params: URLSearchParams) => CallbackResult = () => ({ kind: 'ignore', reason: 'not ready' });

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const result = onRequest(url.searchParams);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Connection', 'close');
    if (result.kind === 'token') {
      res.writeHead(200).end(page('Login complete', 'You can close this tab and return to the terminal.'));
    } else if (result.kind === 'error') {
      res.writeHead(400).end(page('Login failed', 'Check the terminal for details.'));
    } else {
      warn(`ignored a callback request: ${result.reason}`);
      res.writeHead(400).end(page('Ignored', 'This request does not belong to the current mcdi-cli login.'));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;

  return {
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
    waitForToken(expectedState, timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          onRequest = () => ({ kind: 'ignore', reason: 'login already timed out' });
          reject(
            new CliError(
              `timed out after ${Math.round(timeoutMs / 1000)}s waiting for the browser login. ` +
                'If your browser ended up on the MCDI admin panel instead, this MCDI instance does not ' +
                'support CLI login yet (mcdi-cli issue #2).',
              ExitCode.Auth,
            ),
          );
        }, timeoutMs);
        onRequest = (params) => {
          const result = readCallback(params, expectedState);
          if (result.kind === 'ignore') return result;
          clearTimeout(timer);
          onRequest = () => ({ kind: 'ignore', reason: 'login already finished' });
          if (result.kind === 'token') resolve(result.token);
          else reject(new CliError(`MCDI reported a login failure: ${result.message}`, ExitCode.Auth));
          return result;
        };
      });
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export async function login(options: LoginOptions, deps: LoginDeps): Promise<void> {
  const config = await loadConfig(deps.configPath);
  const profileName = resolveProfileName(config, options.profile);
  const baseUrl = resolveBaseUrl(config, profileName, options.baseUrl);

  const listener = await startCallbackListener(deps.info);
  try {
    const discordUrl = await getAdminLoginUrl(baseUrl, listener.redirectUri);
    const state = extractState(discordUrl);
    const tokenPromise = listener.waitForToken(state, deps.timeoutMs);
    // Awaited below; this only stops an early rejection from being reported as unhandled meanwhile.
    tokenPromise.catch(() => {});

    const opened = await deps.openBrowser(discordUrl);
    deps.info(
      opened
        ? `Opened your browser to log in with Discord. If it didn't open, visit:\n  ${discordUrl}`
        : `Couldn't open a browser automatically. Open this URL to log in with Discord:\n  ${discordUrl}`,
    );
    deps.info('Waiting for the login to complete...');

    const token = await tokenPromise;
    const me = await getAdminMe(baseUrl, token);
    const admin = adminDisplayName(me);

    const session = {
      accessToken: await encrypt(token, deps.keys),
      expiresAt: me.sessionExpiresAt,
      adminIdentity: `${me.username}#${me.id}`,
    };
    // Re-read so a profile changed by another command while we waited isn't clobbered.
    const latest = await loadConfig(deps.configPath);
    await saveConfig(setSession(latest, profileName, baseUrl, session), deps.configPath);

    deps.out(`Logged in as ${admin} on ${profileName}`);
  } finally {
    await listener.close();
  }
}
