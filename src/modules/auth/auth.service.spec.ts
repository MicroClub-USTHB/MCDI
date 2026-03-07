import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { LoginTokenRepository } from './repositories/login-token.repository';
import { AdminOAuthStateRepository } from './repositories/admin-oauth-state.repository';
import { DiscordService } from '../discord/discord.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ServersRepository } from '../servers/servers.repository';

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

const mockServersRepo = {
  findMain: jest.fn(),
  findByName: jest.fn(),
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
  markAsUsed: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockLoginTokenRepo = {
  create: jest.fn(),
  findValid: jest.fn(),
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
      'discord.adminRedirectUri': 'http://localhost/auth/admin/discord/callback',
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
        { provide: LoginTokenRepository, useValue: mockLoginTokenRepo },
        { provide: AdminOAuthStateRepository, useValue: mockAdminOAuthStateRepo },
        { provide: ProjectsRepository, useValue: mockProjectsRepo },
        { provide: ServersRepository, useValue: mockServersRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── validateLoginRequest ────────────────────────────────────────────────

  describe('validateLoginRequest', () => {
    it('throws UnauthorizedException when API key is not found', async () => {
      mockProjectsRepo.findByApiKey.mockResolvedValue(null);
      await expect(service.validateLoginRequest('bad-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException for external project without serverId or serverName', async () => {
      mockProjectsRepo.findByApiKey.mockResolvedValue(
        fakeProject({ isInternal: false }),
      );
      await expect(
        service.validateLoginRequest('pk_good.secret'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when main server is not configured for internal project', async () => {
      mockProjectsRepo.findByApiKey.mockResolvedValue(
        fakeProject({ isInternal: true }),
      );
      mockServersRepo.findMain.mockResolvedValue(null);
      await expect(
        service.validateLoginRequest('pk_good.secret'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when project has no access to the server', async () => {
      mockProjectsRepo.findByApiKey.mockResolvedValue(
        fakeProject({ isInternal: false }),
      );
      mockProjectsRepo.hasServerAccess.mockResolvedValue(false);
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);
      await expect(
        service.validateLoginRequest(
          'pk_good.secret',
          'guild-1',
          undefined,
          'http://localhost/callback',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns project info and resolved serverId on success', async () => {
      const project = fakeProject({ isInternal: false });
      mockProjectsRepo.findByApiKey.mockResolvedValue(project);
      mockProjectsRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);

      const result = await service.validateLoginRequest(
        'pk_good.secret',
        'guild-1',
        undefined,
        'http://localhost/callback',
      );
      expect(result.project.id).toBe('proj-1');
      expect(result.serverId).toBe('guild-1');
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

  // ── validateLoginRequest — additional branches ─────────────────────────

  describe('validateLoginRequest (additional branches)', () => {
    it('resolves serverId by serverName when serverId is omitted', async () => {
      const project = fakeProject({ isInternal: false });
      mockProjectsRepo.findByApiKey.mockResolvedValue(project);
      mockServersRepo.findByName.mockResolvedValue({
        id: 'guild-by-name',
      });
      mockProjectsRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);

      const result = await service.validateLoginRequest(
        'pk_good.secret',
        undefined,
        'Main Server',
        'http://localhost/callback',
      );
      expect(result.serverId).toBe('guild-by-name');
    });

    it('throws BadRequestException when server is not found by name', async () => {
      const project = fakeProject({ isInternal: false });
      mockProjectsRepo.findByApiKey.mockResolvedValue(project);
      mockServersRepo.findByName.mockResolvedValue(null);

      await expect(
        service.validateLoginRequest(
          'pk_good.secret',
          undefined,
          'Unknown Server',
          'http://localhost/callback',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles internal project using main server id', async () => {
      const project = fakeProject({ isInternal: true });
      mockProjectsRepo.findByApiKey.mockResolvedValue(project);
      mockServersRepo.findMain.mockResolvedValue({ id: 'main-guild' });
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);

      const result = await service.validateLoginRequest(
        'pk_good.secret',
        undefined,
        undefined,
        'http://localhost/callback',
      );
      expect(result.serverId).toBe('main-guild');
    });

    it('throws BadRequestException when project has no redirect URI configured', async () => {
      const project = fakeProject({ isInternal: false, redirectUri: null });
      mockProjectsRepo.findByApiKey.mockResolvedValue(project);
      mockProjectsRepo.hasServerAccess.mockResolvedValue(true);
      await expect(
        service.validateLoginRequest('pk_good.secret', 'guild-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when redirect URI is not on the allowlist', async () => {
      const project = fakeProject({ isInternal: false });
      mockProjectsRepo.findByApiKey.mockResolvedValue(project);
      mockProjectsRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(false);

      await expect(
        service.validateLoginRequest(
          'pk_good.secret',
          'guild-1',
          undefined,
          'http://evil.com/callback',
        ),
      ).rejects.toThrow(ForbiddenException);
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

    it('returns error redirect when state token is invalid/expired', async () => {
      mockOAuthStateRepo.findValidState.mockResolvedValue(null);

      const result = await service.handleDiscordCallback(
        'code-123',
        'bad-state',
      );
      expect(result).toMatchObject({
        url: expect.stringContaining('invalid_state'),
      });
    });

    it('returns error redirect when Discord token exchange fails', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
      };
      mockOAuthStateRepo.findValidState.mockResolvedValue(stateData);
      mockOAuthStateRepo.markAsUsed.mockResolvedValue(undefined);

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
    });

    it('returns error redirect when Discord profile fetch fails', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
      };
      mockOAuthStateRepo.findValidState.mockResolvedValue(stateData);
      mockOAuthStateRepo.markAsUsed.mockResolvedValue(undefined);

      mockDiscordService.exchangeOAuthCode.mockResolvedValue('acc-tok');
      mockDiscordService.fetchOAuthProfile.mockResolvedValue(null); // profile fetch fails

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('profile_error'),
      });
    });

    it('returns error redirect when user is not in the Discord server', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
      };
      mockOAuthStateRepo.findValidState.mockResolvedValue(stateData);
      mockOAuthStateRepo.markAsUsed.mockResolvedValue(undefined);
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
      }); // not in server

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('not_in_server'),
      });
    });

    it('returns error redirect when user lacks required roles', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
      };
      mockOAuthStateRepo.findValidState.mockResolvedValue(stateData);
      mockOAuthStateRepo.markAsUsed.mockResolvedValue(undefined);
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
        roleIds: ['role-other'], // user has role-other, not role-required
      });
      mockDiscordService.fetchGuildRolesForMember.mockResolvedValue([]);

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('insufficient_roles'),
      });
    });

    it('creates session and returns redirect URL on success (no role restriction)', async () => {
      const stateData = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        redirectUri: 'http://localhost/callback',
      };
      mockOAuthStateRepo.findValidState.mockResolvedValue(stateData);
      mockOAuthStateRepo.markAsUsed.mockResolvedValue(undefined);
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
    it('calls deleteExpired on session, oauth state, login token, and admin oauth state repos', async () => {
      mockSessionRepo.deleteExpired.mockResolvedValue(undefined);
      mockOAuthStateRepo.deleteExpired.mockResolvedValue(undefined);
      mockLoginTokenRepo.deleteExpired.mockResolvedValue(undefined);
      mockAdminOAuthStateRepo.deleteExpired.mockResolvedValue(undefined);

      const result = await service.cleanupExpired();
      expect(result).toEqual({ success: true });
      expect(mockSessionRepo.deleteExpired).toHaveBeenCalled();
      expect(mockOAuthStateRepo.deleteExpired).toHaveBeenCalled();
      expect(mockLoginTokenRepo.deleteExpired).toHaveBeenCalled();
      expect(mockAdminOAuthStateRepo.deleteExpired).toHaveBeenCalled();
    });
  });

  // ── createLoginSession ──────────────────────────────────────────────────

  describe('createLoginSession', () => {
    it('validates API key, creates token, and returns loginUrl', async () => {
      mockProjectsRepo.findByApiKey.mockResolvedValue(null);
      // Use full project flow mocking via validateLoginRequest path
      const proj = fakeProject();
      // Mock the project lookup that validateApiKeyAndGetProject does
      mockProjectsRepo.findByApiKey.mockResolvedValue(proj);
      mockProjectsRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectsRepo.isRedirectUriAllowed.mockResolvedValue(true);
      mockLoginTokenRepo.create.mockResolvedValue({ token: 'abc123' });

      const result = await service.createLoginSession(
        'pk_1234.secrethex',
        'srv-1',
        undefined,
        'http://localhost/callback',
      );

      expect(result.loginUrl).toContain('/api/auth/login/');
      expect(mockLoginTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          serverId: 'srv-1',
          redirectUri: 'http://localhost/callback',
        }),
      );
    });

    it('throws when API key is invalid', async () => {
      mockProjectsRepo.findByApiKey.mockResolvedValue(null);

      await expect(
        service.createLoginSession('bad.key', 'srv-1', undefined, 'http://localhost/callback'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── resolveLoginToken ───────────────────────────────────────────────────

  describe('resolveLoginToken', () => {
    it('returns token data when valid', async () => {
      const tokenData = {
        token: 'abc',
        projectId: 'p1',
        serverId: 's1',
        redirectUri: 'http://localhost/callback',
        expiresAt: new Date(Date.now() + 300000),
      };
      mockLoginTokenRepo.findValid.mockResolvedValue(tokenData);
      mockProjectsRepo.findOne.mockResolvedValue({ id: 'p1', name: 'My Project' });

      const result = await service.resolveLoginToken('abc');
      expect(result).toEqual({ ...tokenData, projectName: 'My Project' });
    });

    it('returns null when token is expired or not found', async () => {
      mockLoginTokenRepo.findValid.mockResolvedValue(null);

      const result = await service.resolveLoginToken('expired-token');
      expect(result).toBeNull();
    });
  });
});
