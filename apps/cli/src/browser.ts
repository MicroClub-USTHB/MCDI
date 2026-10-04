import { spawn } from 'node:child_process';

/**
 * Opens a URL in the system default browser. Resolves to false when no opener
 * could be launched so the caller can fall back to printing the URL. Never goes
 * through a shell, so the URL can't be interpreted as a command.
 */
export function openBrowser(url: string, platform: NodeJS.Platform = process.platform): Promise<boolean> {
  const [command, args] =
    platform === 'darwin'
      ? ['open', [url]]
      : platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: 'ignore', detached: true });
    } catch {
      resolve(false);
      return;
    }
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
