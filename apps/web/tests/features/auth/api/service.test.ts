import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../setup';

const BASE_URL = 'http://localhost:3000/api';

describe('getDiscordOAuthUrl', () => {
  it('points at the backend OAuth entry point with no query params', async () => {
    const { getDiscordOAuthUrl } = await import('@/features/auth/api/service');

    // The backend generates its own `state` and accepts no `redirect` — any
    // param appended here would be silently dropped.
    expect(getDiscordOAuthUrl()).toBe(`${BASE_URL}/auth/admin/discord`);
  });
});

describe('post-login redirect handoff', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('round-trips the intended path across the OAuth bounce', async () => {
    const { rememberPostLoginRedirect, consumePostLoginRedirect } =
      await import('@/features/auth/api/service');

    rememberPostLoginRedirect('/dashboard/members');

    expect(consumePostLoginRedirect()).toBe('/dashboard/members');
  });

  it('clears the stash once consumed so a later visit cannot replay it', async () => {
    const { rememberPostLoginRedirect, consumePostLoginRedirect } =
      await import('@/features/auth/api/service');

    rememberPostLoginRedirect('/dashboard/members');
    consumePostLoginRedirect();

    expect(consumePostLoginRedirect()).toBe('/dashboard');
  });

  it('defaults to /dashboard when nothing was stashed', async () => {
    const { consumePostLoginRedirect } = await import('@/features/auth/api/service');

    expect(consumePostLoginRedirect()).toBe('/dashboard');
  });

  it('refuses an off-site path on the way in', async () => {
    const { rememberPostLoginRedirect, consumePostLoginRedirect } =
      await import('@/features/auth/api/service');

    rememberPostLoginRedirect('https://evil.com/steal');

    expect(consumePostLoginRedirect()).toBe('/dashboard');
  });

  it('refuses an off-site path written straight into storage by something else', async () => {
    const { consumePostLoginRedirect } = await import('@/features/auth/api/service');
    window.sessionStorage.setItem('mcdi.auth.post-login-redirect', '//evil.com');

    expect(consumePostLoginRedirect()).toBe('/dashboard');
  });
});

describe('fetchCurrentAdmin', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('returns the admin profile from the unenveloped response body', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/admin/me`, () =>
        HttpResponse.json({
          id: '1',
          username: 'admin',
          globalName: null,
          displayName: 'Prez',
          avatar: null,
          email: 'admin@mcdi.dev',
          isSystemAdmin: true,
          sessionExpiresAt: '2026-08-07T10:00:00.000Z',
        })
      )
    );

    const { fetchCurrentAdmin } = await import('@/features/auth/api/service');
    const response = await fetchCurrentAdmin();

    expect(response.data.username).toBe('admin');
    expect(response.data.sessionExpiresAt).toBe('2026-08-07T10:00:00.000Z');
  });
});

describe('logoutAdmin', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('posts to /auth/admin/logout with no body — the backend reads the cookie', async () => {
    let called = 0;
    let body: string | null = null;
    server.use(
      http.post(`${BASE_URL}/auth/admin/logout`, async ({ request }) => {
        called += 1;
        body = await request.text();
        return HttpResponse.json({ success: true });
      })
    );

    const { logoutAdmin } = await import('@/features/auth/api/service');
    const response = await logoutAdmin();

    expect(called).toBe(1);
    expect(body).toBe('');
    expect(response.data).toEqual({ success: true });
  });

  it('surfaces a rejected session so the caller can still finish logging out', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/admin/logout`, () =>
        HttpResponse.json(
          { message: 'Session has expired', error: 'Unauthorized', statusCode: 401 },
          { status: 401 }
        )
      )
    );

    const { logoutAdmin } = await import('@/features/auth/api/service');

    await expect(logoutAdmin()).rejects.toMatchObject({ status: 401 });
  });
});
