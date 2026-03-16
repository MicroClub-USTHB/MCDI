import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

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

const mockAdminAuthService = {
  adminPasswordLogin: jest.fn(),
  buildAdminDiscordLoginUrl: jest.fn(),
  handleAdminDiscordCallback: jest.fn(),
  getMe: jest.fn(),
  setPassword: jest.fn(),
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
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AdminAuthService, useValue: mockAdminAuthService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createLoginSession ────────────────────────────────────────────────

  describe('createLoginSession', () => {
    it('throws UnauthorizedException when X-API-Key header is missing', async () => {
      await expect(
        controller.createLoginSession(
          undefined as any,
          { redirectUri: 'http://localhost/callback' } as any,
        ),
      ).rejects.toThrow('X-API-Key header is required');
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
        undefined,
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
        requestId: 'req-123',
        url: 'https://discord.com/oauth2/authorize?...',
      });
      const req = { cookies: { mcdi_login_ctx: 'valid-token' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.redirect).toHaveBeenCalledWith(
        'https://discord.com/oauth2/authorize?...',
      );
      expect(res.clearCookie).toHaveBeenCalledWith('mcdi_login_ctx');
      expect(res.cookie).toHaveBeenCalledWith(
        'request_id',
        'req-123',
        expect.objectContaining({ httpOnly: true, secure: true }),
      );
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
        requestId: 'req-xyz',
        url: 'https://discord.com/oauth2/authorize?state=xyz',
      });
      const req = { cookies: { mcdi_login_ctx: 'valid-token' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(mockAuthService.buildDiscordLoginUrl).toHaveBeenCalledWith(
        'proj-42',
        'srv-99',
        'https://platform.example.com/callback',
        undefined,
      );
    });
  });

  // ── discordCallback ──────────────────────────────────────────────────

  it('discordCallback redirects with a callback code on success', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      url: 'http://localhost/callback?code=cb-123&state=state-123',
    });
    const res = {
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
    const req = { cookies: { request_id: 'req-123' } };
    await controller.discordCallback(
      'code123',
      'state456',
      req as any,
      res as any,
    );
    expect(mockAuthService.handleDiscordCallback).toHaveBeenCalledWith(
      'code123',
      'req-123',
      'state456',
    );
    expect(res.clearCookie).toHaveBeenCalledWith('request_id');
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost/callback?code=cb-123&state=state-123',
    );
  });

  it('discordCallback redirects on error', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      url: 'http://localhost/callback?error=invalid_state',
    });
    const res = {
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
    const req = { cookies: { request_id: 'req-456' } };
    await controller.discordCallback(
      'code123',
      'bad-state',
      req as any,
      res as any,
    );
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost/callback?error=invalid_state',
    );
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

  // ── adminMe ───────────────────────────────────────────────────────────

  describe('adminMe', () => {
    it('extracts token and delegates to adminAuthService.getMe', async () => {
      const profile = { id: 'u1', username: 'admin', isSystemAdmin: true };
      mockAdminAuthService.getMe.mockResolvedValue(profile);
      const req = { headers: { authorization: 'Bearer test-token' } };
      const result = await controller.adminMe(req as any);
      expect(mockAdminAuthService.getMe).toHaveBeenCalledWith('test-token');
      expect(result).toMatchObject({ id: 'u1', isSystemAdmin: true });
    });
  });

  // ── adminSetPassword ──────────────────────────────────────────────────

  describe('adminSetPassword', () => {
    it('delegates with no currentPassword when setting for the first time', async () => {
      mockAdminAuthService.setPassword.mockResolvedValue({
        message: 'Password updated successfully',
      });
      const req = { headers: { authorization: 'Bearer test-token' } };
      const dto = { newPassword: 'newSecure!1' };
      const result = await controller.adminSetPassword(req as any, dto as any);
      expect(mockAdminAuthService.setPassword).toHaveBeenCalledWith(
        'test-token',
        undefined,
        'newSecure!1',
      );
      expect(result).toEqual({ message: 'Password updated successfully' });
    });

    it('delegates with currentPassword when changing existing password', async () => {
      mockAdminAuthService.setPassword.mockResolvedValue({
        message: 'Password updated successfully',
      });
      const req = { headers: { authorization: 'Bearer test-token' } };
      const dto = { currentPassword: 'oldPass!1', newPassword: 'newSecure!1' };
      await controller.adminSetPassword(req as any, dto as any);
      expect(mockAdminAuthService.setPassword).toHaveBeenCalledWith(
        'test-token',
        'oldPass!1',
        'newSecure!1',
      );
    });
  });
});
