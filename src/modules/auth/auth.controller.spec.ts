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
};

const mockRes = () => ({ redirect: jest.fn() });

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

  // ── login ────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns error context when apiKey is missing', async () => {
      const result = await controller.login(
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
      );
      expect(result).toMatchObject({ error: 'missing_api_key' });
    });

    it('returns project context on valid API key', async () => {
      mockAuthService.validateLoginRequest.mockResolvedValue({
        project: { id: 'p1', name: 'Events' },
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
      });
      const result = await controller.login(
        'pk.key',
        undefined as any,
        undefined as any,
        undefined as any,
      );
      expect(result).toMatchObject({ projectName: 'Events', serverId: 's1' });
    });

    it('returns error context when service throws', async () => {
      mockAuthService.validateLoginRequest.mockRejectedValue(
        new Error('Bad API key'),
      );
      const result = await controller.login(
        'bad.key',
        undefined as any,
        undefined as any,
        undefined as any,
      );
      expect(result).toMatchObject({ error: 'invalid_request' });
    });
  });

  // ── startDiscordAuth ─────────────────────────────────────────────────

  describe('startDiscordAuth', () => {
    it('redirects to Discord OAuth URL', async () => {
      mockAuthService.validateLoginRequest.mockResolvedValue({
        project: { id: 'p1' },
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
      });
      mockAuthService.buildDiscordLoginUrl.mockResolvedValue({
        url: 'https://discord.com/oauth2/authorize?...',
      });
      const res = mockRes();
      await controller.startDiscordAuth(
        'pk.key',
        's1',
        undefined as any,
        'http://localhost/callback',
        res as any,
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'https://discord.com/oauth2/authorize?...',
      );
    });

    it('propagates error when validateLoginRequest throws', async () => {
      mockAuthService.validateLoginRequest.mockRejectedValue(
        new Error('Invalid API key'),
      );
      const res = mockRes();
      await expect(
        controller.startDiscordAuth(
          'bad.key',
          's1',
          undefined as any,
          'http://localhost/callback',
          res as any,
        ),
      ).rejects.toThrow('Invalid API key');
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('propagates error when buildDiscordLoginUrl throws', async () => {
      mockAuthService.validateLoginRequest.mockResolvedValue({
        project: { id: 'p1' },
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
      });
      mockAuthService.buildDiscordLoginUrl.mockRejectedValue(
        new Error('Failed to build URL'),
      );
      const res = mockRes();
      await expect(
        controller.startDiscordAuth(
          'pk.key',
          's1',
          undefined as any,
          'http://localhost/callback',
          res as any,
        ),
      ).rejects.toThrow('Failed to build URL');
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('passes resolved project id, serverId and redirectUri to buildDiscordLoginUrl', async () => {
      mockAuthService.validateLoginRequest.mockResolvedValue({
        project: { id: 'proj-42' },
        serverId: 'srv-99',
        redirectUri: 'https://platform.example.com/callback',
      });
      mockAuthService.buildDiscordLoginUrl.mockResolvedValue({
        url: 'https://discord.com/oauth2/authorize?state=xyz',
      });
      const res = mockRes();
      await controller.startDiscordAuth(
        'pk.key',
        'srv-99',
        undefined as any,
        'https://platform.example.com/callback',
        res as any,
      );
      expect(mockAuthService.buildDiscordLoginUrl).toHaveBeenCalledWith(
        'proj-42',
        'pk.key',
        'srv-99',
        'https://platform.example.com/callback',
      );
    });
  });

  // ── discordCallback ──────────────────────────────────────────────────

  it('discordCallback redirects to result URL', async () => {
    mockAuthService.handleDiscordCallback.mockResolvedValue({
      url: 'http://localhost/callback?token=abc',
    });
    const res = mockRes();
    await controller.discordCallback('code123', 'state456', res as any);
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost/callback?token=abc',
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
});
