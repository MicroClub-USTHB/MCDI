import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { saveConfig } from './config.js';

/**
 * Runs the real CLI entry point and closes its stdout before it writes, the way
 * `mcid-cli ... | head` does once head has read enough.
 */
async function runWithClosedStdout(args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', join(import.meta.dirname, 'index.ts'), ...args],
    {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.destroy();
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
  return { code, stderr };
}

describe('stdout closed early (EPIPE)', () => {
  it('exits quietly with 0 instead of crashing with a stack trace', async () => {
    // A profile without a session: `logout` prints one stdout line and never touches the keychain.
    const configPath = join(await mkdtemp(join(tmpdir(), 'mcid-cli-epipe-')), 'config.json');
    await saveConfig(
      {
        version: 1,
        activeProfile: 'prod',
        profiles: { prod: { baseUrl: 'https://mcid.example.com', session: null } },
      },
      configPath,
    );

    const { code, stderr } = await runWithClosedStdout(['logout', '--profile', 'prod'], {
      MCID_CLI_CONFIG_PATH: configPath,
    });

    expect(stderr).not.toContain('EPIPE');
    expect(stderr).toBe('');
    expect(code).toBe(0);
  }, 20_000);
});

describe('usage errors', () => {
  it('exit 64, not the pre-check failure code', async () => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', join(import.meta.dirname, 'index.ts'), 'logout'],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(stderr).toContain("required option '--profile <name>'");
    expect(code).toBe(64);
  }, 20_000);
});
