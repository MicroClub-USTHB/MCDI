import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { openBrowser } from './browser.js';
import {
  configPath,
  loadConfig,
  normalizeBaseUrl,
  resolveBaseUrl,
  resolveProfileName,
  setSession,
  updateConfig,
} from './config.js';
import { defaultKeyProvider, encrypt, sessionContext, type KeyProvider } from './crypto-store.js';
import { CliError, ExitCode, stripControlCharacters } from './errors.js';
import { adminDisplayName, exchangeAdminLoginCode, getAdminLoginUrl, getAdminMe } from './mcid.js';
import { createPkcePair } from './pkce.js';

const CALLBACK_PATH = '/callback';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
/** The only host the CLI opens a login URL on: MCID's login always goes through Discord. */
const DISCORD_HOST = 'discord.com';

export interface LoginOptions {
  /** Required: a state-changing command never falls back to the active profile (CLAUDE.md). */
  profile: string;
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
    keys: defaultKeyProvider(),
    openBrowser: (url) => openBrowser(url),
    info: (line) => process.stderr.write(`${line}\n`),
    out: (line) => process.stdout.write(`${line}\n`),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export type CallbackResult =
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | { kind: 'ignore'; reason: string };

/**
 * Reads MCID's redirect to the loopback listener: `?code=<one-time code>&state=`
 * once the admin login succeeded, or `?error=<message>&state=` when MCID
 * refused it (for example, no admin role).
 *
 * A code is only accepted alongside the exact `state` this login started with,
 * so another local process can't feed it one; and the code is useless without
 * this login's PKCE verifier anyway. An `error` is accepted without it because
 * the worst a forged one can do is abort this login.
 */
export function readCallback(params: URLSearchParams, expectedState: string): CallbackResult {
  // Checked first, so another local process can't abort the login with a fake error.
  if (params.get('state') !== expectedState) {
    return { kind: 'ignore', reason: 'state does not match this login attempt' };
  }
  const error = params.get('error');
  if (error) return { kind: 'error', message: stripControlCharacters(error) };
  const code = params.get('code');
  if (!code) return { kind: 'ignore', reason: 'callback is missing the login code' };
  return { kind: 'code', code };
}

/** Pulls the OAuth `state` MCID generated out of the Discord URL, so the callback can be tied back to it. */
export function extractState(discordUrl: string): string {
  let url: URL;
  try {
    url = new URL(discordUrl);
  } catch {
    throw new CliError('MCID returned an invalid Discord URL', ExitCode.Unexpected);
  }
  if (url.protocol !== 'https:') {
    throw new CliError(
      `refusing to open a non-https login URL from MCID (${url.protocol})`,
      ExitCode.Unexpected,
    );
  }
  if (url.hostname !== DISCORD_HOST) {
    throw new CliError(
      `refusing to open a login URL that is not on ${DISCORD_HOST} (${url.hostname})`,
      ExitCode.Unexpected,
    );
  }
  const state = url.searchParams.get('state');
  if (!state)
    throw new CliError('MCID login URL has no OAuth state parameter', ExitCode.Unexpected);
  return state;
}

/**
 * The page the browser shows after the Discord login. It uses the colours and
 * type of the mcoli-ui "primary" theme (the Micro Club design system the admin
 * panel uses), light or dark to match the system setting. Fonts are not
 * fetched: the page names DM Sans and Plus Jakarta Sans and falls back to the
 * system font, so nothing leaves this machine.
 */
const page = (title: string, body: string, variant: 'success' | 'error' = 'success') => {
  const icon =
    variant === 'success'
      ? '<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      : '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>';
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mcid-cli</title>
<style>
  :root {
    color-scheme: light dark;
    --background: #ffffff;
    --foreground: #000350;
    --card: #ffffff;
    --border: #e6e9ff;
    --muted-foreground: #54588b;
    --primary: #0006b1;
    --primary-foreground: #ffffff;
    --secondary: #e6e9ff;
    --success: #22c55e;
    --error: #e7000b;
    --shadow: 0 4px 12px -4px hsl(0 0% 0% / 0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --background: #0a0a0a;
      --foreground: #fafafa;
      --card: #171717;
      --border: #262626;
      --muted-foreground: #a1a1a1;
      --primary: #d9ddff;
      --primary-foreground: #000350;
      --secondary: #262626;
      --shadow: 0 4px 12px -4px hsl(0 0% 0% / 0.4);
    }
  }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    box-sizing: border-box;
    background: var(--background);
    color: var(--foreground);
    font-family: "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .card {
    width: 100%;
    max-width: 24rem;
    box-sizing: border-box;
    text-align: center;
    padding: 2rem;
    border-radius: 0.75rem;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted-foreground);
  }
  .mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    background: var(--primary);
    color: var(--primary-foreground);
    font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    background: color-mix(in oklab, var(--accent) 12%, transparent);
  }
  .icon.success { --accent: var(--success); }
  .icon.error { --accent: var(--error); }
  h1 {
    margin: 0 0 0.5rem;
    font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
  }
  p { margin: 0; color: var(--muted-foreground); font-size: 0.875rem; line-height: 1.25rem; }
</style>
<main class="card">
  <div class="brand"><span class="mark" aria-hidden="true">MC</span>mcid-cli</div>
  <div class="icon ${variant}"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></div>
  <h1>${title}</h1>
  <p>${body}</p>
</main>`;
};

interface CallbackListener {
  redirectUri: string;
  /** Resolves with the one-time login code, rejects on an MCID error or timeout. */
  waitForCode(expectedState: string, timeoutMs: number): Promise<string>;
  close(): Promise<void>;
}

/** Starts a one-shot HTTP listener on 127.0.0.1 (never all interfaces) on an OS-chosen port. */
export async function startCallbackListener(
  warn: (line: string) => void,
): Promise<CallbackListener> {
  let onRequest: (params: URLSearchParams) => CallbackResult = () => ({
    kind: 'ignore',
    reason: 'not ready',
  });

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const result = onRequest(url.searchParams);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Connection', 'close');
    if (result.kind === 'code') {
      res
        .writeHead(200)
        .end(
          page('Login complete', 'You can close this tab and return to the terminal.', 'success'),
        );
    } else if (result.kind === 'error') {
      res.writeHead(400).end(page('Login failed', 'Check the terminal for details.', 'error'));
    } else {
      warn(`ignored a callback request: ${result.reason}`);
      res
        .writeHead(400)
        .end(
          page('Ignored', 'This request does not belong to the current mcid-cli login.', 'error'),
        );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;

  return {
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
    waitForCode(expectedState, timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          onRequest = () => ({ kind: 'ignore', reason: 'login already timed out' });
          reject(
            new CliError(
              `timed out after ${Math.round(timeoutMs / 1000)}s waiting for the browser login. ` +
                'If your browser ended up on the MCID admin panel instead, this MCID instance does not ' +
                'support CLI login yet (mcid-cli issue #2).',
              ExitCode.Auth,
            ),
          );
        }, timeoutMs);
        onRequest = (params) => {
          const result = readCallback(params, expectedState);
          if (result.kind === 'ignore') return result;
          clearTimeout(timer);
          onRequest = () => ({ kind: 'ignore', reason: 'login already finished' });
          if (result.kind === 'code') resolve(result.code);
          else
            reject(new CliError(`MCID reported a login failure: ${result.message}`, ExitCode.Auth));
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
  const existing = config.profiles[profileName];
  const secrets = Object.keys(existing?.webhookSecrets ?? {}).length;
  if (existing && secrets > 0 && normalizeBaseUrl(existing.baseUrl) !== baseUrl) {
    throw new CliError(
      `profile "${profileName}" holds ${secrets} webhook signing secret(s) for ${existing.baseUrl}; ` +
        'log in to another MCID on a new profile instead (`mcid-cli profile add`)',
      ExitCode.PrecheckFailed,
    );
  }

  const listener = await startCallbackListener(deps.info);
  try {
    const pkce = createPkcePair();
    const discordUrl = await getAdminLoginUrl(baseUrl, listener.redirectUri, pkce.challenge);
    const state = extractState(discordUrl);
    const codePromise = listener.waitForCode(state, deps.timeoutMs);
    // Awaited below; this only stops an early rejection from being reported as unhandled meanwhile.
    codePromise.catch(() => {});

    const opened = await deps.openBrowser(discordUrl);
    deps.info(
      opened
        ? `Opened your browser to log in with Discord. If it didn't open, visit:\n  ${discordUrl}`
        : `Couldn't open a browser automatically. Open this URL to log in with Discord:\n  ${discordUrl}`,
    );
    deps.info('Waiting for the login to complete...');

    const code = await codePromise;
    const { token } = await exchangeAdminLoginCode(baseUrl, code, pkce.verifier);
    const me = await getAdminMe(baseUrl, token);
    const admin = adminDisplayName(me);

    const session = {
      accessToken: await encrypt(token, deps.keys, sessionContext(profileName)),
      expiresAt: me.sessionExpiresAt,
      adminIdentity: `${me.username}#${me.id}`,
    };
    // Applied to the latest config, so a profile changed by another command while we waited isn't clobbered.
    await updateConfig(deps.configPath, (latest) =>
      setSession(latest, profileName, baseUrl, session),
    );

    deps.out(`Logged in as ${admin} on ${profileName}`);
  } finally {
    await listener.close();
  }
}
