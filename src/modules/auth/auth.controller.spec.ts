import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  validateLoginRequest: jest.fn(),
  buildDiscordLoginUrl: jest.fn(),
  handleDiscordCallback: jest.fn(),
  validateSession: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  cleanupExpired: jest.fn(),
  createLoginSession: jest.fn(),
  resolveLoginToken: jest.fn(),
};

const mockRes = () => ({
  redirect: jest.fn(),
  cookie: jest.fn(),
  clearCookie: jest.fn(),
  render: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createLoginSession ────────────────────────────────────────────────

  describe('createLoginSession', () => {
    it('returns error when X-API-Key header is missing', async () => {
      const result = await controller.createLoginSession(
        undefined as any,
        { redirectUri: 'http://localhost/callback' } as any,
      );
      expect(result).toMatchObject({ error: 'missing_api_key' });
    });

    it('delegates to authService.createLoginSession', async () => {
      mockAuthService.createLoginSession.mockResolvedValue({
        loginUrl: '/api/auth/login/abc123',
      });
      const result = await controller.createLoginSession('pk_1234.secret', {
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
      });
      expect(result).toMatchObject({ loginUrl: '/api/auth/login/abc123' });
      expect(mockAuthService.createLoginSession).toHaveBeenCalledWith(
        'pk_1234.secret',
        's1',
        undefined,
        'http://localhost/callback',
      );
    });
  });

  // ── login ────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns error context when token is missing', async () => {
      const res = mockRes();
      const result = await controller.login(undefined as any, res as any);
      expect(result).toMatchObject({ error: 'missing_token' });
    });

    it('returns project context and sets cookie on valid login token', async () => {
      mockAuthService.resolveLoginToken.mockResolvedValue({
        projectId: 'p1',
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
      });
      const res = mockRes();
      const result = await controller.login('valid-token', res as any);
      expect(result).toMatchObject({ serverId: 's1' });
      expect(res.cookie).toHaveBeenCalledWith(
        'mcdi_login_ctx',
        'valid-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('returns error when token is expired', async () => {
      mockAuthService.resolveLoginToken.mockResolvedValue(null);
      const res = mockRes();
      const result = await controller.login('expired-token', res as any);
      expect(result).toMatchObject({ error: 'invalid_token' });
    });

    it('returns error when service throws', async () => {
      mockAuthService.resolveLoginToken.mockRejectedValue(
        new Error('DB error'),
      );
      const res = mockRes();
      const result = await controller.login('bad-token', res as any);
      expect(result).toMatchObject({ error: 'invalid_request' });
    });
  });

  // ── startDiscordAuth ─────────────────────────────────────────────────

  describe('startDiscordAuth', () => {
    it('redirects to Discord OAuth URL with valid login token from cookie', async () => {
      mockAuthService.resolveLoginToken.mockResolvedValue({
        projectId: 'p1',
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
      });
      mockAuthService.buildDiscordLoginUrl.mockResolvedValue({
        url: 'https://discord.com/oauth2/authorize?...',
      });
      const req = { cookies: { mcdi_login_ctx: 'valid-token' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.redirect).toHaveBeenCalledWith(
        'https://discord.com/oauth2/authorize?...',
      );
      expect(res.clearCookie).toHaveBeenCalledWith('mcdi_login_ctx');
    });

    it('renders error page when cookie is missing', async () => {
      const req = { cookies: {} };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.render).toHaveBeenCalledWith(
        'login',
        expect.objectContaining({
          error: 'missing_context',
        }),
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('renders error page when login token is invalid', async () => {
      mockAuthService.resolveLoginToken.mockResolvedValue(null);
      const req = { cookies: { mcdi_login_ctx: 'bad-token' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.render).toHaveBeenCalledWith(
        'login',
        expect.objectContaining({
          error: 'invalid_token',
        }),
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('passes token data to buildDiscordLoginUrl', async () => {
      mockAuthService.resolveLoginToken.mockResolvedValue({
        projectId: 'proj-42',
        serverId: 'srv-99',
        redirectUri: 'https://platform.example.com/callback',
      });
      mockAuthService.buildDiscordLoginUrl.mockResolvedValue({
        url: 'https://discord.com/oauth2/authorize?state=xyz',
      });
      const req = { cookies: { mcdi_login_ctx: 'valid-token' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(mockAuthService.buildDiscordLoginUrl).toHaveBeenCalledWith(
        'proj-42',
        'srv-99',
        'https://platform.example.com/callback',
      );
    });
  });

  // ── discordCallback ──────────────────────────────────────────────────

  it('discordCallback sends HTML form post on success', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      html: '<html><form method="POST"></form></html>',
    });
    const res = {
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
      redirect: jest.fn(),
    };
    await controller.discordCallback('code123', 'state456', res as any);
    expect(res.type).toHaveBeenCalledWith('html');
    expect(res.send).toHaveBeenCalledWith(
      '<html><form method="POST"></form></html>',
    );
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('discordCallback redirects on error', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      url: 'http://localhost/callback?error=invalid_state',
    });
    const res = {
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
      redirect: jest.fn(),
    };
    await controller.discordCallback('code123', 'bad-state', res as any);
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost/callback?error=invalid_state',
    );
    expect(res.send).not.toHaveBeenCalled();
  });

  // ── validateSession ──────────────────────────────────────────────────

  it('validateSession delegates to authService', async () => {
    mockAuthService.validateSession.mockResolvedValue({
      member: {},
      roles: [],
    });
    const result = await controller.validateSession({ token: 'tok' });
    expect(mockAuthService.validateSession).toHaveBeenCalledWith('tok');
    expect(result).toMatchObject({ roles: [] });
  });

  // ── logout ────────────────────────────────────────────────────────────

  it('logout delegates to authService', async () => {
    mockAuthService.logout.mockResolvedValue({ success: true });
    const result = await controller.logout({ token: 'tok' });
    expect(result).toEqual({ success: true });
  });

  it('logoutAll delegates to authService', async () => {
    mockAuthService.logoutAll.mockResolvedValue({ success: true });
    await controller.logoutAll({ memberId: 'u1' });
    expect(mockAuthService.logoutAll).toHaveBeenCalledWith('u1');
  });

  it('cleanupExpired delegates to authService', async () => {
    mockAuthService.cleanupExpired.mockResolvedValue({ success: true });
    const result = await controller.cleanupExpired();
    expect(result).toEqual({ success: true });
  });
});
