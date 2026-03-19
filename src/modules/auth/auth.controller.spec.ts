import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockAuthService = {
  authorize: jest.fn(),
  consumeAuthRequest: jest.fn(),
  findAuthRequestById: jest.fn(),
  buildDiscordLoginUrl: jest.fn(),
  handleDiscordCallback: jest.fn(),
  validateSession: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  cleanupExpired: jest.fn(),
  exchangeCodeForToken: jest.fn(),
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
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  type: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AdminAuthService, useValue: mockAdminAuthService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'app.apiPrefix' ? 'api' : 'development',
          },
        },
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

  // ── authorize ───────────────────────────────────────────────────────

  describe('authorize', () => {
    it('creates auth request, sets cookie, and redirects to /auth/discord', async () => {
      mockAuthService.authorize.mockResolvedValue({
        ok: true,
        requestId: 'req-uuid-123',
      });
      const res = mockRes();
      const dto = {
        client_id: 'project-uuid',
        redirect_uri: 'http://localhost/callback',
        server_id: '123456789',
        state: 'csrf-token',
      };
      await controller.authorize(dto, res as any);
      expect(res.cookie).toHaveBeenCalledWith(
        'mcdi_auth_req',
        'req-uuid-123',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(res.redirect).toHaveBeenCalledWith('/api/auth/discord');
    });

    it('redirects error to client when redirect_uri was validated', async () => {
      mockAuthService.authorize.mockResolvedValue({
        ok: false,
        error: 'access_denied',
        description: 'Project does not have access to this server',
        redirectUri: 'http://localhost/callback',
        state: 'csrf-token',
      });
      const res = mockRes();
      const dto = {
        client_id: 'project-uuid',
        redirect_uri: 'http://localhost/callback',
        server_id: '123456789',
        state: 'csrf-token',
      };
      await controller.authorize(dto, res as any);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=access_denied'),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('state=csrf-token'),
      );
    });

    it('returns JSON error when redirect_uri cannot be trusted', async () => {
      mockAuthService.authorize.mockResolvedValue({
        ok: false,
        error: 'invalid_client',
        description: 'Unknown or inactive client_id',
        state: 'csrf-token',
      });
      const res = mockRes();
      const dto = {
        client_id: 'bad-uuid',
        redirect_uri: 'http://evil.com',
        server_id: '123456789',
        state: 'csrf-token',
      };
      await controller.authorize(dto, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'invalid_client' }),
      );
    });
  });

  // ── startDiscordAuth ─────────────────────────────────────────────────

  describe('startDiscordAuth', () => {
    it('redirects to Discord OAuth URL with valid auth request from cookie', async () => {
      mockAuthService.consumeAuthRequest.mockResolvedValue({
        clientId: 'p1',
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
        state: 'csrf-abc',
      });
      mockAuthService.buildDiscordLoginUrl.mockResolvedValue({
        url: 'https://discord.com/oauth2/authorize?...',
      });
      const req = { cookies: { mcdi_auth_req: 'req-uuid-123' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(mockAuthService.consumeAuthRequest).toHaveBeenCalledWith(
        'req-uuid-123',
      );
      expect(res.clearCookie).toHaveBeenCalledWith('mcdi_auth_req');
      expect(res.redirect).toHaveBeenCalledWith(
        'https://discord.com/oauth2/authorize?...',
      );
    });

    it('returns HTML error page when cookie is missing', async () => {
      const req = { cookies: {} };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.type).toHaveBeenCalledWith('html');
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('missing_context'),
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('redirects error to client when auth request is expired or used', async () => {
      mockAuthService.consumeAuthRequest.mockResolvedValue(null);
      mockAuthService.findAuthRequestById.mockResolvedValue({
        redirectUri: 'http://localhost/callback',
        state: 'csrf-abc',
      });
      const req = { cookies: { mcdi_auth_req: 'bad-uuid' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=invalid_request'),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('state=csrf-abc'),
      );
      expect(res.clearCookie).toHaveBeenCalledWith('mcdi_auth_req');
    });

    it('returns HTML error page when auth request is not found at all', async () => {
      mockAuthService.consumeAuthRequest.mockResolvedValue(null);
      mockAuthService.findAuthRequestById.mockResolvedValue(null);
      const req = { cookies: { mcdi_auth_req: 'gone-uuid' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.type).toHaveBeenCalledWith('html');
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('invalid_request'),
      );
    });

    it('passes client state to buildDiscordLoginUrl', async () => {
      mockAuthService.consumeAuthRequest.mockResolvedValue({
        clientId: 'proj-42',
        serverId: 'srv-99',
        redirectUri: 'https://platform.example.com/callback',
        state: 'platform-csrf-xyz',
      });
      mockAuthService.buildDiscordLoginUrl.mockResolvedValue({
        url: 'https://discord.com/oauth2/authorize?state=xyz',
      });
      const req = { cookies: { mcdi_auth_req: 'req-uuid' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(mockAuthService.buildDiscordLoginUrl).toHaveBeenCalledWith(
        'proj-42',
        'srv-99',
        'https://platform.example.com/callback',
        'platform-csrf-xyz',
      );
    });
  });

  // ── discordCallback ────────────────────────────────────────────────

  it('discordCallback redirects to platform with callback code on success', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      url: 'http://localhost/callback?code=abc123&state=csrf',
    });
    const res = { redirect: jest.fn() };
    await controller.discordCallback('code123', 'state456', res as any);
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost/callback?code=abc123&state=csrf',
    );
  });

  it('discordCallback redirects on error', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      url: 'http://localhost/callback?error=invalid_state',
    });
    const res = { redirect: jest.fn() };
    await controller.discordCallback('code123', 'bad-state', res as any);
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost/callback?error=invalid_state',
    );
  });

  // ── validateSession ────────────────────────────────────────────────

  it('validateSession delegates to authService', async () => {
    mockAuthService.validateSession.mockResolvedValue({
      member: {},
      roles: [],
    });
    const req = { project: { id: 'p1' } };
    const result = await controller.validateSession({ token: 'tok' }, req as any);
    expect(mockAuthService.validateSession).toHaveBeenCalledWith('tok', 'p1');
    expect(result).toMatchObject({ roles: [] });
  });

  // ── exchangeCode ────────────────────────────────────────────────────

  it('exchangeCode delegates to authService', async () => {
    const expiresAt = new Date();
    mockAuthService.exchangeCodeForToken.mockResolvedValue({
      token: 'new-tok',
      expiresAt,
    });
    const req = { project: { id: 'p1' } };
    const result = await controller.exchangeCode(
      { code: 'c1' },
      req as any,
    );
    expect(mockAuthService.exchangeCodeForToken).toHaveBeenCalledWith('c1', 'p1');
    expect(result).toEqual({ token: 'new-tok', expiresAt });
  });

  // ── logout ──────────────────────────────────────────────────────────

  it('logout delegates to authService', async () => {
    mockAuthService.logout.mockResolvedValue({ success: true });
    const req = { project: { id: 'p1' } };
    const result = await controller.logout({ token: 'tok' }, req as any);
    expect(mockAuthService.logout).toHaveBeenCalledWith('tok', 'p1');
    expect(result).toEqual({ success: true });
  });

  it('logoutAll delegates to authService', async () => {
    mockAuthService.logoutAll.mockResolvedValue({ success: true });
    const req = { project: { id: 'p1' } };
    await controller.logoutAll({ memberId: 'u1' }, req as any);
    expect(mockAuthService.logoutAll).toHaveBeenCalledWith('u1', 'p1');
  });

  it('cleanupExpired delegates to authService', async () => {
    mockAuthService.cleanupExpired.mockResolvedValue({ success: true });
    const result = await controller.cleanupExpired();
    expect(result).toEqual({ success: true });
  });

  // ── adminMe ─────────────────────────────────────────────────────────

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

  // ── adminSetPassword ────────────────────────────────────────────────

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
