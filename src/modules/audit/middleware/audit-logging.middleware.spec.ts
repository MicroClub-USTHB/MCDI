import { AuditLoggingMiddleware } from './audit-logging.middleware';

describe('AuditLoggingMiddleware', () => {
  let repo: { insert: jest.Mock };
  let service: { recordUsage: jest.Mock };
  let middleware: AuditLoggingMiddleware;

  beforeEach(() => {
    repo = { insert: jest.fn().mockResolvedValue(undefined) };
    service = { recordUsage: jest.fn().mockResolvedValue(undefined) };
    middleware = new AuditLoggingMiddleware(repo as any, service as any);
  });

  afterEach(() => jest.clearAllMocks());

  function run(opts: {
    method: string;
    url: string;
    statusCode?: number;
    cookies?: Record<string, string>;
    query?: Record<string, unknown>;
    locals?: Record<string, unknown>;
    memberId?: string;
    project?: { id: string };
    headers?: Record<string, unknown>;
    ip?: string;
    route?: unknown;
  }) {
    let finish: (() => void) | undefined;
    const res = {
      statusCode: opts.statusCode ?? 200,
      locals: opts.locals ?? {},
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') finish = cb;
      }),
    };
    const req = {
      method: opts.method,
      originalUrl: opts.url,
      headers: opts.headers ?? {},
      cookies: opts.cookies,
      query: opts.query ?? {},
      ip: opts.ip ?? '10.0.0.1',
      memberId: opts.memberId,
      project: opts.project,
      route: opts.route,
    };
    const next = jest.fn();

    middleware.use(req as any, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1); // next always runs
    finish?.();
  }

  it('audits a successful mapped mutation with actor, entity and IP', () => {
    run({
      method: 'POST',
      url: '/api/admin/projects?foo=bar',
      statusCode: 201,
      memberId: 'admin-1',
      headers: {
        'x-forwarded-for': '203.0.113.7, 70.41.3.18',
        'user-agent': 'jest',
      },
    });

    expect(repo.insert).toHaveBeenCalledTimes(1);
    const entry = repo.insert.mock.calls[0][0];
    expect(entry).toMatchObject({
      actorId: 'admin-1',
      actionType: 'project',
      action: 'created',
      entityType: 'project',
      ipAddress: '203.0.113.7',
      userAgent: 'jest',
      severity: 'info',
    });
    expect(entry.details).toMatchObject({
      method: 'POST',
      path: '/admin/projects',
      statusCode: 201,
    });
    expect(service.recordUsage).toHaveBeenCalledWith(
      'POST',
      '/admin/projects',
      201,
      expect.any(Number),
      undefined,
    );
  });

  it('extracts the entity id from the path', () => {
    run({
      method: 'PATCH',
      url: '/api/admin/projects/abc-123',
      statusCode: 200,
    });
    expect(repo.insert.mock.calls[0][0]).toMatchObject({
      action: 'updated',
      entityId: 'abc-123',
    });
  });

  it('audits member export (a GET that mutates nothing but is sensitive)', () => {
    run({ method: 'GET', url: '/api/admin/members/export', statusCode: 200 });
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert.mock.calls[0][0]).toMatchObject({
      actionType: 'member',
      action: 'exported',
    });
  });

  it('does not audit ordinary GET reads but still records usage', () => {
    run({ method: 'GET', url: '/api/admin/projects', statusCode: 200 });
    expect(repo.insert).not.toHaveBeenCalled();
    expect(service.recordUsage).toHaveBeenCalledWith(
      'GET',
      '/admin/projects',
      200,
      expect.any(Number),
      undefined,
    );
  });

  it('does not audit failed requests (>=400) but records usage', () => {
    run({ method: 'POST', url: '/api/admin/projects', statusCode: 400 });
    expect(repo.insert).not.toHaveBeenCalled();
    expect(service.recordUsage).toHaveBeenCalledWith(
      'POST',
      '/admin/projects',
      400,
      expect.any(Number),
      undefined,
    );
  });

  it('collapses 404s for unknown paths into one usage key but keeps the path for matched routes', () => {
    run({ method: 'GET', url: '/api/wp-admin/setup.php', statusCode: 404 });
    expect(service.recordUsage).toHaveBeenCalledWith(
      'GET',
      '/<unmatched>',
      404,
      expect.any(Number),
      undefined,
    );

    run({
      method: 'GET',
      url: '/api/members/123456789',
      statusCode: 404,
      route: { path: '/api/members/:id' },
    });
    expect(service.recordUsage).toHaveBeenLastCalledWith(
      'GET',
      '/members/123456789',
      404,
      expect.any(Number),
      undefined,
    );
  });

  it('does not audit unmapped mutations but records usage', () => {
    run({ method: 'POST', url: '/api/admin/unmapped', statusCode: 200 });
    expect(repo.insert).not.toHaveBeenCalled();
    expect(service.recordUsage).toHaveBeenCalledWith(
      'POST',
      '/admin/unmapped',
      200,
      expect.any(Number),
      undefined,
    );
  });

  it('audits the admin logout route', () => {
    run({
      method: 'POST',
      url: '/api/auth/admin/logout',
      statusCode: 200,
      memberId: 'admin-1',
    });
    expect(repo.insert.mock.calls[0][0]).toMatchObject({
      actorId: 'admin-1',
      actionType: 'auth',
      action: 'logout',
      entityType: 'session',
    });
  });

  it('records a rejected session token as a warning with the stashed reason and IP', () => {
    run({
      method: 'GET',
      url: '/api/auth/admin/me',
      statusCode: 401,
      headers: { authorization: 'Bearer not-a-real-token' },
      locals: { authFailureReason: 'Invalid or expired session' },
      ip: '198.51.100.2',
    });
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert.mock.calls[0][0]).toMatchObject({
      actorId: null,
      actionType: 'auth',
      action: 'session_rejected',
      entityType: 'session',
      severity: 'warning',
      ipAddress: '198.51.100.2',
      details: {
        reason: 'Invalid or expired session',
        method: 'GET',
        path: '/auth/admin/me',
        attemptedActor: null,
      },
    });
    expect(service.recordUsage).toHaveBeenCalledTimes(1);
  });

  it('records a rejected API key by prefix only and keeps the actor for a 403 from a known member', () => {
    run({
      method: 'GET',
      url: '/api/members/123',
      statusCode: 401,
      headers: { 'x-api-key': 'pk_abc123.supersecretvalue' },
      locals: { authFailureReason: 'Invalid API key' },
    });
    const apiKeyEntry = repo.insert.mock.calls[0][0];
    expect(apiKeyEntry).toMatchObject({
      action: 'api_key_rejected',
      details: { reason: 'Invalid API key', attemptedActor: 'pk_abc123' },
    });
    expect(JSON.stringify(apiKeyEntry)).not.toContain('supersecretvalue');

    run({
      method: 'GET',
      url: '/api/admin/projects',
      statusCode: 403,
      memberId: 'member-9',
      cookies: { admin_session: 'cookie-token' },
      locals: { authFailureReason: 'Access restricted' },
    });
    expect(repo.insert.mock.calls[1][0]).toMatchObject({
      actorId: 'member-9',
      action: 'session_rejected',
      details: { reason: 'Access restricted', attemptedActor: null },
    });
  });

  it('ignores a 401 that carried no credential at all', () => {
    run({ method: 'GET', url: '/api/auth/admin/me', statusCode: 401 });
    expect(repo.insert).not.toHaveBeenCalled();
    expect(service.recordUsage).toHaveBeenCalledTimes(1);
  });

  it('ignores a 401 raised after the API key was already accepted', () => {
    run({
      method: 'GET',
      url: '/api/members/123',
      statusCode: 401,
      project: { id: 'proj-1' },
      headers: { 'x-api-key': 'pk_abc123.supersecretvalue' },
      locals: { authFailureReason: 'Authentication required' },
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('ignores a 403 that rejected no credential, such as a disabled server', () => {
    run({
      method: 'GET',
      url: '/api/members/123',
      statusCode: 403,
      headers: { 'x-api-key': 'pk_abc123.supersecretvalue' },
      locals: { authFailureReason: 'Server is disabled' },
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('treats a dotted bearer value as an API key and stores only the prefix', () => {
    run({
      method: 'GET',
      url: '/api/members/123',
      statusCode: 401,
      headers: { authorization: 'Bearer pk_abc123.secret' },
      locals: { authFailureReason: 'Invalid API key' },
    });
    expect(repo.insert).toHaveBeenCalledTimes(1);
    const entry = repo.insert.mock.calls[0][0];
    expect(entry).toMatchObject({
      action: 'api_key_rejected',
      details: { reason: 'Invalid API key', attemptedActor: 'pk_abc123' },
    });
    expect(JSON.stringify(entry)).not.toContain('secret');
  });

  it('forwards the request duration and the authenticated project id for non-admin routes', () => {
    jest.useFakeTimers();
    try {
      let finish: (() => void) | undefined;
      const res = {
        statusCode: 401,
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'finish') finish = cb;
        }),
      };
      const req = {
        method: 'POST',
        originalUrl: '/api/auth/validate',
        headers: {},
        query: {},
        ip: '10.0.0.1',
        project: { id: 'proj-1' },
      };
      const next = jest.fn();

      middleware.use(req as any, res as any, next as any);
      jest.advanceTimersByTime(25);
      finish?.();

      expect(repo.insert).not.toHaveBeenCalled();
      expect(service.recordUsage).toHaveBeenCalledWith(
        'POST',
        '/auth/validate',
        401,
        25,
        'proj-1',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to req.ip when no x-forwarded-for header is present', () => {
    run({
      method: 'POST',
      url: '/api/admin/servers',
      statusCode: 201,
      ip: '198.51.100.2',
    });
    expect(repo.insert.mock.calls[0][0]).toMatchObject({
      actionType: 'server',
      action: 'registered',
      ipAddress: '198.51.100.2',
      actorId: null,
    });
  });

  it('records a request once when Express runs the middleware twice for it', () => {
    let finish: (() => void) | undefined;
    const res = {
      statusCode: 200,
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') finish = cb;
      }),
    };
    const req = {
      method: 'GET',
      originalUrl: '/api/admin/projects',
      headers: {},
      ip: '10.0.0.1',
    };
    const next = jest.fn();

    middleware.use(req as any, res as any, next as any);
    middleware.use(req as any, res as any, next as any);
    finish?.();

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.on).toHaveBeenCalledTimes(1);
    expect(service.recordUsage).toHaveBeenCalledTimes(1);
  });

  it('swallows repository write failures', () => {
    repo.insert.mockRejectedValue(new Error('db down'));
    expect(() =>
      run({ method: 'POST', url: '/api/admin/projects', statusCode: 201 }),
    ).not.toThrow();
  });
});
