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
  buildDiscordLoginUrl: jest.fn(),
  handleDiscordCallback: jest.fn(),
  validateSession: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  cleanupExpired: jest.fn(),
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
      expect(mockAuthService.authorize).toHaveBeenCalledWith(
        'project-uuid',
        'http://localhost/callback',
        '123456789',
        'csrf-token',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'mcdi_auth_req',
        'req-uuid-123',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(res.redirect).toHaveBeenCalledWith('/api/auth/discord');
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

    it('returns 400 when cookie is missing', async () => {
      const req = { cookies: {} };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'missing_context' }),
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('returns 400 when auth request is invalid or expired', async () => {
      mockAuthService.consumeAuthRequest.mockResolvedValue(null);
      const req = { cookies: { mcdi_auth_req: 'bad-uuid' } };
      const res = mockRes();
      await controller.startDiscordAuth(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'invalid_request' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith('mcdi_auth_req');
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

  // ── validateSession ────────────────────────────────────────────────

  it('validateSession delegates to authService', async () => {
    mockAuthService.validateSession.mockResolvedValue({
      member: {},
      roles: [],
    });
    const result = await controller.validateSession({ token: 'tok' });
    expect(mockAuthService.validateSession).toHaveBeenCalledWith('tok');
    expect(result).toMatchObject({ roles: [] });
  });

  // ── logout ──────────────────────────────────────────────────────────

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
