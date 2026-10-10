import { afterEach, describe, expect, it } from 'vitest';
import { openBrowser } from './browser.js';

describe('openBrowser', () => {
  const originalPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it('resolves false when no opener can be launched, so the URL gets printed instead', async () => {
    process.env.PATH = '/nonexistent';
    expect(await openBrowser('https://discord.com/oauth2/authorize?state=x', 'linux')).toBe(false);
    expect(await openBrowser('https://discord.com/oauth2/authorize?state=x', 'darwin')).toBe(false);
  });
});
