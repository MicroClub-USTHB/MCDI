import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { AuthRequestRepository } from './repositories/auth-request.repository';
import { AdminOAuthStateRepository } from './repositories/admin-oauth-state.repository';
import { DiscordService } from '../discord/discord.service';
import { ProjectsRepository } from '../projects/projects.repository';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSessionRepo = {
  create: jest.fn(),
  findByTokenWithMember: jest.fn(),
  deleteByToken: jest.fn(),
  deleteByMemberId: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockMemberRepo = {
  upsert: jest.fn(),
  syncMemberServerData: jest.fn(),
  getMemberRolesInServer: jest.fn(),
};

const mockProjectsRepo = {
  findByApiKey: jest.fn(),
  isRedirectUriAllowed: jest.fn(),
  findAllowedRoleIds: jest.fn(),
  findOne: jest.fn(),
  hasServerAccess: jest.fn(),
};

const mockOAuthStateRepo = {
  create: jest.fn(),
  findValidState: jest.fn(),
  consumeValid: jest.fn(),
  findByState: jest.fn(),
  markAsUsed: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockAuthRequestRepo = {
  create: jest.fn(),
  consumeValid: jest.fn(),
  findById: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockAdminOAuthStateRepo = {
  create: jest.fn(),
  findValidState: jest.fn(),
  markAsUsed: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockDiscordService = {
  exchangeOAuthCode: jest.fn(),
  fetchOAuthProfile: jest.fn(),
  fetchOAuthGuildMember: jest.fn(),
  fetchGuildRolesForMember: jest.fn(),
};
const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      'discord.clientId': 'client-id',
      'discord.clientSecret': 'client-secret',
      'discord.redirectUri': 'http://localhost/auth/discord/callback',
      'discord.adminRedirectUri':
        'http://localhost/auth/admin/discord/callback',
      'app.baseUrl': 'http://localhost',
    };
    return map[key];
  }),
};

const fakeProject = (overrides = {}) => ({
  id: 'proj-1',
  name: 'Test',
  isInternal: false,
  redirectUri: 'http://localhost/callback',
  isActive: true,
  ...overrides,
});

// ── Suite ──────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SessionRepository, useValue: mockSessionRepo },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: OAuthStateRepository, useValue: mockOAuthStateRepo },
        { provide: AuthRequestRepository, useValue: mockAuthRequestRepo },
        {
          provide: AdminOAuthStateRepository,
          useValue: mockAdminOAuthStateRepo,
        },
        { provide: ProjectsRepository, useValue: mockProjectsRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── authorize ──────────────────────────────────────────────────────────

  describe('authorize', () => {
    it('returns error when client_id is not found', async () => {
      mockProjectsRepo.findOne.mockResolvedValue(null);
      const result = await service.authorize(
        'bad-id',
        'http://localhost/cb',
        's1',
        'state',
      );
      expect(result).toMatchObject({ ok: false, error: 'invalid_client' });
    });

    it('returns error when project is inactive', async () => {
      mockProjectsRepo.findOne.mockResolvedValue(
        fakeProject({ isActive: false }),
      );
      const result = await service.authorize(
        'proj-1',
        'http://localhost/cb',
        's1',
        'state',
      );
      expect(result).toMatchObject({ ok: false, error: 'invalid_client' });
    });

    it('returns error without redirectUri when redirect_uri is not allowed', async () => {
      mockProjectsRepo.findOne.mockResolvedValue(fakeProject());
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(false);
      const result = await service.authorize(
        'proj-1',
        'http://evil.com',
        's1',
        'state',
      );
      expect(result).toMatchObject({
        ok: false,
        error: 'invalid_redirect_uri',
      });
      expect((result as any).redirectUri).toBeUndefined();
    });

    it('returns error with redirectUri when server access is denied', async () => {
      mockProjectsRepo.findOne.mockResolvedValue(fakeProject());
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);
      mockProjectsRepo.hasServerAccess.mockResolvedValue(false);
      const result = await service.authorize(
        'proj-1',
        'http://localhost/cb',
        's1',
        'state',
      );
      expect(result).toMatchObject({
        ok: false,
        error: 'access_denied',
        redirectUri: 'http://localhost/cb',
        state: 'state',
      });
    });

    it('creates auth request and returns ok with requestId on success', async () => {
      mockProjectsRepo.findOne.mockResolvedValue(fakeProject());
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);
      mockProjectsRepo.hasServerAccess.mockResolvedValue(true);
      mockAuthRequestRepo.create.mockResolvedValue({
        requestId: 'req-uuid-123',
      });

      const result = await service.authorize(
        'proj-1',
        'http://localhost/cb',
        's1',
        'csrf-token',
      );
      expect(result).toEqual({ ok: true, requestId: 'req-uuid-123' });
    });
  });

  // ── buildDiscordLoginUrl ────────────────────────────────────────────────

  describe('buildDiscordLoginUrl', () => {
    it('stores the OAuth state and returns a Discord URL', async () => {
      mockOAuthStateRepo.create.mockResolvedValue(undefined);

      const result = await service.buildDiscordLoginUrl(
        'proj-1',
        'guild-1',
        'http://localhost/callback',
      );

      expect(result.url).toContain('discord.com');
      expect(mockOAuthStateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', serverId: 'guild-1' }),
      );
    });
  });

  // ── validateSession ─────────────────────────────────────────────────────

  describe('validateSession', () => {
    it('throws UnauthorizedException when session is not found', async () => {
      mockSessionRepo.findByTokenWithMember.mockResolvedValue(null);
      await expect(service.validateSession('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException and deletes session when expired', async () => {
      const past = new Date(Date.now() - 1_000);
      mockSessionRepo.findByTokenWithMember.mockResolvedValue({
        memberId: 'u1',
        expiresAt: past,
        serverId: null,
        member: {},
      });
      mockSessionRepo.deleteByToken.mockResolvedValue(undefined);

      await expect(service.validateSession('exp-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockSessionRepo.deleteByToken).toHaveBeenCalledWith('exp-token');
    });

    it('returns member and roles for a valid session', async () => {
      const future = new Date(Date.now() + 999_999_999);
      mockSessionRepo.findByTokenWithMember.mockResolvedValue({
        memberId: 'u1',
        expiresAt: future,
        serverId: 'guild-1',
        member: { id: 'u1', username: 'alice' },
      });
      mockMemberRepo.getMemberRolesInServer.mockResolvedValue([
        { name: 'Member' },
      ]);

      const result = await service.validateSession('valid-token');
      expect(result.member).toMatchObject({ username: 'alice' });
      expect(result.roles).toHaveLength(1);
    });
  });

  // ── consumeAuthRequest ────────────────────────────────────────────────

  describe('consumeAuthRequest', () => {
    it('atomically consumes and returns a valid auth request', async () => {
      const req = { requestId: 'r1', clientId: 'p1', serverId: 's1' };
      mockAuthRequestRepo.consumeValid.mockResolvedValue(req);
      const result = await service.consumeAuthRequest('r1');
      expect(result).toEqual(req);
      expect(mockAuthRequestRepo.consumeValid).toHaveBeenCalledWith('r1');
    });

    it('returns null when expired or already used', async () => {
      mockAuthRequestRepo.consumeValid.mockResolvedValue(null);
      const result = await service.consumeAuthRequest('bad-id');
      expect(result).toBeNull();
    });
  });

  // ── handleDiscordCallback ───────────────────────────────────────────────

  describe('handleDiscordCallback', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      fetchMock = jest.spyOn(global as any, 'fetch');
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    function mockFetchResponse(data: unknown, ok = true, status = 200) {
      return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(String(data)),
      });
    }

    it('redirects error to client when state is expired but row exists', async () => {
      mockOAuthStateRepo.consumeValid.mockResolvedValue(null);
      mockOAuthStateRepo.findByState.mockResolvedValue({
        redirectUri: 'http://localhost/callback',
        clientState: 'csrf-xyz',
      });

      const result = await service.handleDiscordCallback(
        'code-123',
        'expired-state',
      );
      expect(result).toMatchObject({
        url: expect.stringContaining('invalid_state'),
      });
      // Should redirect to the client's URI, not the fallback
      expect((result as any).url).toContain('localhost/callback');
      expect((result as any).url).toContain('state=csrf-xyz');
    });

    it('redirects to fallback when state token is completely unknown', async () => {
      mockOAuthStateRepo.consumeValid.mockResolvedValue(null);
      mockOAuthStateRepo.findByState.mockResolvedValue(null);

      const result = await service.handleDiscordCallback(
        'code-123',
        'unknown-state',
      );
      expect(result).toMatchObject({
        url: expect.stringContaining('invalid_state'),
      });
      // Falls back to app.baseUrl/error
      expect((result as any).url).toContain('localhost/error');
    });

    it('returns error redirect when Discord token exchange fails', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
        clientState: 'csrf-abc',
      };
      mockOAuthStateRepo.consumeValid.mockResolvedValue(stateData);

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ error: 'invalid_code' }, false, 400),
      );

      const result = await service.handleDiscordCallback(
        'bad-code',
        'valid-state',
      );
      expect(result).toMatchObject({
        url: expect.stringContaining('discord_error'),
      });
      expect((result as any).url).toContain('state=csrf-abc');
    });

    it('returns error redirect when Discord profile fetch fails', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
        clientState: 'csrf-abc',
      };
      mockOAuthStateRepo.consumeValid.mockResolvedValue(stateData);

      mockDiscordService.exchangeOAuthCode.mockResolvedValue('acc-tok');
      mockDiscordService.fetchOAuthProfile.mockResolvedValue(null);

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('profile_error'),
      });
      expect((result as any).url).toContain('state=csrf-abc');
    });

    it('returns error redirect when user is not in the Discord server', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
        clientState: 'csrf-abc',
      };
      mockOAuthStateRepo.consumeValid.mockResolvedValue(stateData);
      mockMemberRepo.upsert.mockResolvedValue({
        id: 'user-1',
        username: 'alice',
      });

      mockDiscordService.exchangeOAuthCode.mockResolvedValue('acc-tok');
      mockDiscordService.fetchOAuthProfile.mockResolvedValue({
        id: 'user-1',
        username: 'alice',
      });
      mockDiscordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: false,
        status: 404,
        roleIds: [],
      });

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('not_in_server'),
      });
      expect((result as any).url).toContain('state=csrf-abc');
    });

    it('returns error redirect when user lacks required roles', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
        clientState: 'csrf-abc',
      };
      mockOAuthStateRepo.consumeValid.mockResolvedValue(stateData);
      mockMemberRepo.upsert.mockResolvedValue({
        id: 'user-1',
        username: 'alice',
      });
      mockMemberRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectsRepo.findAllowedRoleIds.mockResolvedValue(['role-required']);

      mockDiscordService.exchangeOAuthCode.mockResolvedValue('acc-tok');
      mockDiscordService.fetchOAuthProfile.mockResolvedValue({
        id: 'user-1',
        username: 'alice',
        email: null,
      });
      mockDiscordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: true,
        status: 200,
        roleIds: ['role-other'],
      });
      mockDiscordService.fetchGuildRolesForMember.mockResolvedValue([]);

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('insufficient_roles'),
      });
      expect((result as any).url).toContain('state=csrf-abc');
    });

    it('creates session and returns redirect URL on success (no role restriction)', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
        clientState: 'csrf-abc',
      };
      mockOAuthStateRepo.consumeValid.mockResolvedValue(stateData);
      mockMemberRepo.upsert.mockResolvedValue({
        id: 'user-1',
        username: 'alice',
        globalName: null,
        displayName: null,
        avatar: null,
        email: null,
      });
      mockMemberRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectsRepo.findAllowedRoleIds.mockResolvedValue([]); // no role restriction
      mockSessionRepo.create.mockResolvedValue(undefined);
      mockMemberRepo.getMemberRolesInServer.mockResolvedValue([
        { name: 'Member' },
      ]);

      mockDiscordService.exchangeOAuthCode.mockResolvedValue('acc-tok');
      mockDiscordService.fetchOAuthProfile.mockResolvedValue({
        id: 'user-1',
        username: 'alice',
        global_name: null,
        display_name: null,
        avatar: null,
        email: null,
      });
      mockDiscordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: true,
        status: 200,
        roleIds: [],
      });
      mockDiscordService.fetchGuildRolesForMember.mockResolvedValue([]);

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({ html: expect.stringContaining('token') });
      expect(mockSessionRepo.create).toHaveBeenCalled();
    });
  });

  // ── validateSession — no serverId ───────────────────────────────────────

  describe('validateSession (no serverId)', () => {
    it('returns empty roles when session has no serverId', async () => {
      const future = new Date(Date.now() + 999_999_999);
      mockSessionRepo.findByTokenWithMember.mockResolvedValue({
        memberId: 'u1',
        expiresAt: future,
        serverId: null,
        member: { id: 'u1', username: 'alice' },
      });

      const result = await service.validateSession('valid-token');
      expect(result.roles).toEqual([]);
      expect(mockMemberRepo.getMemberRolesInServer).not.toHaveBeenCalled();
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deletes the session token', async () => {
      mockSessionRepo.deleteByToken.mockResolvedValue(undefined);
      const result = await service.logout('tok');
      expect(result).toEqual({ success: true });
      expect(mockSessionRepo.deleteByToken).toHaveBeenCalledWith('tok');
    });
  });

  // ── logoutAll ───────────────────────────────────────────────────────────

  describe('logoutAll', () => {
    it('deletes all sessions for the member', async () => {
      mockSessionRepo.deleteByMemberId.mockResolvedValue(undefined);
      const result = await service.logoutAll('u1');
      expect(result).toEqual({ success: true });
      expect(mockSessionRepo.deleteByMemberId).toHaveBeenCalledWith('u1');
    });
  });

  // ── cleanupExpired ───────────────────────────────────────────────────────

  describe('cleanupExpired', () => {
    it('calls deleteExpired on session, oauth state, auth request, and admin oauth state repos', async () => {
      mockSessionRepo.deleteExpired.mockResolvedValue(undefined);
      mockOAuthStateRepo.deleteExpired.mockResolvedValue(undefined);
      mockAuthRequestRepo.deleteExpired.mockResolvedValue(undefined);
      mockAdminOAuthStateRepo.deleteExpired.mockResolvedValue(undefined);

      const result = await service.cleanupExpired();
      expect(result).toEqual({ success: true });
      expect(mockSessionRepo.deleteExpired).toHaveBeenCalled();
      expect(mockOAuthStateRepo.deleteExpired).toHaveBeenCalled();
      expect(mockAuthRequestRepo.deleteExpired).toHaveBeenCalled();
      expect(mockAdminOAuthStateRepo.deleteExpired).toHaveBeenCalled();
    });
  });
});
