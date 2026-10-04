import { afterEach, describe, expect, it } from 'vitest';
import { extractState, readCallback, startCallbackListener } from './login-flow.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

describe('readCallback', () => {
  const params = (p: Record<string, string>) => new URLSearchParams(p);

  it('accepts a token only with the matching state', () => {
    expect(readCallback(params({ token: 't', state: 's' }), 's')).toEqual({ kind: 'token', token: 't' });
    expect(readCallback(params({ token: 't', state: 'other' }), 's').kind).toBe('ignore');
    expect(readCallback(params({ token: 't' }), 's').kind).toBe('ignore');
    expect(readCallback(params({ state: 's' }), 's').kind).toBe('ignore');
  });

  it('reports an MCDI error', () => {
    expect(readCallback(params({ error: 'Not an admin' }), 's')).toEqual({ kind: 'error', message: 'Not an admin' });
  });
});

describe('extractState', () => {
  it('reads the state from the Discord URL', () => {
    expect(extractState('https://discord.com/oauth2/authorize?state=abc&client_id=1')).toBe('abc');
  });

  it('refuses non-https URLs, garbage, and URLs without state', () => {
    expect(() => extractState('javascript:alert(1)')).toThrow('non-https');
    expect(() => extractState('http://discord.com/?state=a')).toThrow('non-https');
    expect(() => extractState('nope')).toThrow('invalid Discord URL');
    expect(() => extractState('https://discord.com/oauth2/authorize')).toThrow('no OAuth state');
  });
});

describe('callback listener', () => {
  it('binds to 127.0.0.1 only and 404s anything but GET /callback', async () => {
    const listener = await startCallbackListener(() => {});
    cleanups.push(listener.close);
    const url = new URL(listener.redirectUri);
    expect(url.hostname).toBe('127.0.0.1');
    expect(Number(url.port)).toBeGreaterThan(0);
    expect((await fetch(new URL('/other', url))).status).toBe(404);
    expect((await fetch(url, { method: 'POST' })).status).toBe(404);
  });
});
