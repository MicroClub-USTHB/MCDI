import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { ROOT_PERMISSIONS } from '../helpers/auth';

const BASE_URL = 'http://localhost:3000/api';

const mockUser = {
  id: '1',
  username: 'admin',
  name: 'Admin',
  email: 'admin@mcdi.dev',
  avatar: null,
  isSystemAdmin: true,
  root: true,
  permissions: ROOT_PERMISSIONS,
};

async function authenticatedStore() {
  const { useAuthStore } = await import('@/features/auth/stores/auth');
  useAuthStore.setState({
    user: mockUser,
    sessionExpiresAt: '2026-08-07T10:00:00.000Z',
    isAuthenticated: true,
  });
  return useAuthStore;
}

describe('ApiClient', () => {
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  it('sends the session cookie by including credentials on every request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(http.get(`${BASE_URL}/test`, () => HttpResponse.json({ ok: true })));

    const { ApiClient } = await import('@/shared/lib/api-client');
    await new ApiClient(BASE_URL).get('/test');

    // Without this the browser drops the backend's `admin_session` cookie on
    // every cross-origin call and the whole app 401s.
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('sends no Authorization header — the session is a cookie, not a bearer token', async () => {
    let capturedAuthHeader: string | null = 'not-set';
    server.use(
      http.get(`${BASE_URL}/test`, ({ request }) => {
        capturedAuthHeader = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      })
    );

    await authenticatedStore();
    const { ApiClient } = await import('@/shared/lib/api-client');
    await new ApiClient(BASE_URL).get('/test');

    expect(capturedAuthHeader).toBeNull();
  });

  it('wraps the backend’s unenveloped body in ApiResponse', async () => {
    const profile = { id: '1', username: 'admin', isSystemAdmin: true };
    server.use(http.get(`${BASE_URL}/auth/admin/me`, () => HttpResponse.json(profile)));

    const { ApiClient } = await import('@/shared/lib/api-client');
    const response = await new ApiClient(BASE_URL).get<typeof profile>('/auth/admin/me');

    expect(response).toEqual({ data: profile, status: 200 });
  });

  it('returns null data for a 204 instead of choking on an empty body', async () => {
    server.use(
      http.delete(`${BASE_URL}/sessions/1`, () => new HttpResponse(null, { status: 204 }))
    );

    const { ApiClient } = await import('@/shared/lib/api-client');
    const response = await new ApiClient(BASE_URL).delete('/sessions/1');

    expect(response).toEqual({ data: null, status: 204 });
  });

  it('normalizes a Nest error body into ApiError', async () => {
    server.use(
      http.get(`${BASE_URL}/forbidden`, () =>
        HttpResponse.json(
          {
            message: 'Access restricted to members with a configured admin role',
            error: 'Forbidden',
            statusCode: 403,
          },
          { status: 403 }
        )
      )
    );

    const { ApiClient } = await import('@/shared/lib/api-client');

    await expect(new ApiClient(BASE_URL).get('/forbidden')).rejects.toMatchObject({
      message: 'Access restricted to members with a configured admin role',
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('joins the array message ValidationPipe returns for a rejected DTO', async () => {
    server.use(
      http.post(`${BASE_URL}/things`, () =>
        HttpResponse.json(
          {
            message: ['name should not be empty', 'value must be a number'],
            error: 'Bad Request',
            statusCode: 400,
          },
          { status: 400 }
        )
      )
    );

    const { ApiClient } = await import('@/shared/lib/api-client');

    await expect(new ApiClient(BASE_URL).post('/things', {})).rejects.toMatchObject({
      message: 'name should not be empty; value must be a number',
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('clears local auth on a 401 and does not attempt a refresh', async () => {
    let requestCount = 0;
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE_URL}/protected`, () => {
        requestCount++;
        return HttpResponse.json(
          { message: 'Session has expired', error: 'Unauthorized', statusCode: 401 },
          { status: 401 }
        );
      }),
      // Admin sessions have no refresh counterpart; touching this at all
      // would mean the client is chasing an endpoint that does not exist.
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json({}, { status: 404 });
      })
    );

    const useAuthStore = await authenticatedStore();
    const { ApiClient } = await import('@/shared/lib/api-client');

    await expect(new ApiClient(BASE_URL).get('/protected')).rejects.toMatchObject({ status: 401 });
    expect(requestCount).toBe(1);
    expect(refreshCalls).toBe(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('leaves local auth alone when a 401 comes back from a requiresAuth:false call', async () => {
    server.use(
      http.get(`${BASE_URL}/public`, () =>
        HttpResponse.json(
          { message: 'nope', error: 'Unauthorized', statusCode: 401 },
          { status: 401 }
        )
      )
    );

    const useAuthStore = await authenticatedStore();
    const { ApiClient } = await import('@/shared/lib/api-client');

    await expect(
      new ApiClient(BASE_URL).get('/public', { requiresAuth: false })
    ).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('calls the forbidden handler once for a 403 and still throws the API error', async () => {
    const handler = vi.fn();
    const { ApiClient, setForbiddenHandler } = await import('@/shared/lib/api-client');
    setForbiddenHandler(handler);
    server.use(
      http.get(`${BASE_URL}/admin/members`, () =>
        HttpResponse.json(
          { message: "Requires 'read' access on 'members'", error: 'Forbidden', statusCode: 403 },
          { status: 403 }
        )
      )
    );

    await expect(new ApiClient(BASE_URL).get('/admin/members')).rejects.toMatchObject({
      status: 403,
      message: "Requires 'read' access on 'members'",
    });
    expect(handler).toHaveBeenCalledTimes(1);

    setForbiddenHandler(null);
  });

  it('does not call the forbidden handler for other errors', async () => {
    const handler = vi.fn();
    const { ApiClient, setForbiddenHandler } = await import('@/shared/lib/api-client');
    setForbiddenHandler(handler);
    server.use(
      http.get(`${BASE_URL}/admin/members`, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 })
      )
    );

    await expect(new ApiClient(BASE_URL).get('/admin/members')).rejects.toMatchObject({
      status: 404,
    });
    expect(handler).not.toHaveBeenCalled();

    setForbiddenHandler(null);
  });

  it('supports POST requests with a JSON body', async () => {
    let receivedBody: unknown = null;
    let contentType: string | null = null;
    server.use(
      http.post(`${BASE_URL}/create`, async ({ request }) => {
        contentType = request.headers.get('Content-Type');
        receivedBody = await request.json();
        return HttpResponse.json({ id: '123' });
      })
    );

    const { ApiClient } = await import('@/shared/lib/api-client');
    const payload = { name: 'Test', value: 42 };
    const response = await new ApiClient(BASE_URL).post<{ id: string }>('/create', payload);

    expect(receivedBody).toEqual(payload);
    expect(contentType).toBe('application/json');
    expect(response.data).toEqual({ id: '123' });
  });

  it('omits Content-Type on bodyless requests so they stay CORS-simple', async () => {
    let contentType: string | null = 'not-set';
    server.use(
      http.get(`${BASE_URL}/test`, ({ request }) => {
        contentType = request.headers.get('Content-Type');
        return HttpResponse.json({ ok: true });
      })
    );

    const { ApiClient } = await import('@/shared/lib/api-client');
    await new ApiClient(BASE_URL).get('/test');

    expect(contentType).toBeNull();
  });

  it('reads a plain text body as text, still with the session cookie', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(
      http.get(`${BASE_URL}/docs`, () =>
        HttpResponse.text('# Docs\n\nhello', { headers: { 'Content-Type': 'text/markdown' } })
      )
    );

    const { ApiClient } = await import('@/shared/lib/api-client');
    const response = await new ApiClient(BASE_URL).getText('/docs');
    const cookieMode = (fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.credentials;

    expect(response.data).toBe('# Docs\n\nhello');
    expect(cookieMode).toBe('include');
  });

  it('reports a failed text request like any other failure', async () => {
    server.use(
      http.get(`${BASE_URL}/docs`, () =>
        HttpResponse.json({ message: 'No such webhook', error: 'Not Found' }, { status: 404 })
      )
    );

    const { ApiClient } = await import('@/shared/lib/api-client');

    await expect(new ApiClient(BASE_URL).getText('/docs')).rejects.toMatchObject({
      status: 404,
      message: 'No such webhook',
    });
  });
});
