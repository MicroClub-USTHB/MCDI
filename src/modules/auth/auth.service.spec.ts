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
import { ProjectRepository } from './repositories/project.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { CLOCK, DISCORD_HTTP_CLIENT, TOKEN_GENERATOR } from './providers';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSessionRepo = {
  create: jest.fn(),
  findByTokenWithMember: jest.fn(),
  deleteByToken: jest.fn(),
  deleteByMemberId: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockMemberRepo = { upsert: jest.fn() };

const mockProjectRepo = {
  findByApiKey: jest.fn(),
  findMainServer: jest.fn(),
  findServerByName: jest.fn(),
  hasServerAccess: jest.fn(),
  isRedirectUriAllowed: jest.fn(),
  syncMemberServerData: jest.fn(),
  findAllowedRoleIds: jest.fn(),
  getMemberRolesInServer: jest.fn(),
};

const mockOAuthStateRepo = {
  create: jest.fn(),
  findValidState: jest.fn(),
  markAsUsed: jest.fn(),
  deleteExpired: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      'discord.clientId': 'client-id',
      'discord.clientSecret': 'client-secret',
      'discord.redirectUri': 'http://localhost/auth/discord/callback',
      'discord.token': 'bot-token',
      'app.baseUrl': 'http://localhost',
    };
    return map[key];
  }),
};

const mockDiscordHttpClient = {
  exchangeCodeForToken: jest.fn(),
  fetchUserProfile: jest.fn(),
  fetchGuildMember: jest.fn(),
  fetchGuildRoles: jest.fn(),
};

const fixedNow = new Date('2026-03-06T12:00:00.000Z');
const mockClock = {
  now: jest.fn(() => new Date(fixedNow)),
};

const mockTokenGenerator = {
  randomHex: jest.fn((bytes: number) => `token-${bytes}`),
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
        { provide: ProjectRepository, useValue: mockProjectRepo },
        { provide: OAuthStateRepository, useValue: mockOAuthStateRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DISCORD_HTTP_CLIENT, useValue: mockDiscordHttpClient },
        { provide: CLOCK, useValue: mockClock },
        { provide: TOKEN_GENERATOR, useValue: mockTokenGenerator },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── validateLoginRequest ────────────────────────────────────────────────

  describe('validateLoginRequest', () => {
    it('throws UnauthorizedException when API key is not found', async () => {
      mockProjectRepo.findByApiKey.mockResolvedValue(null);
      await expect(service.validateLoginRequest('bad-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException for external project without serverId or serverName', async () => {
      mockProjectRepo.findByApiKey.mockResolvedValue(
        fakeProject({ isInternal: false }),
      );
      await expect(
        service.validateLoginRequest('pk_good.secret'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when main server is not configured for internal project', async () => {
      mockProjectRepo.findByApiKey.mockResolvedValue(
        fakeProject({ isInternal: true }),
      );
      mockProjectRepo.findMainServer.mockResolvedValue(null);
      await expect(
        service.validateLoginRequest('pk_good.secret'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when project has no access to the server', async () => {
      mockProjectRepo.findByApiKey.mockResolvedValue(
        fakeProject({ isInternal: false }),
      );
      mockProjectRepo.hasServerAccess.mockResolvedValue(false);
      mockProjectRepo.isRedirectUriAllowed.mockResolvedValue(true);
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
      mockProjectRepo.findByApiKey.mockResolvedValue(project);
      mockProjectRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectRepo.isRedirectUriAllowed.mockResolvedValue(true);

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
        'pk_test.key',
        'guild-1',
        'http://localhost/callback',
      );

      expect(result.url).toContain('discord.com');
      expect(mockOAuthStateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'token-32',
          projectId: 'proj-1',
          serverId: 'guild-1',
        }),
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
      mockProjectRepo.getMemberRolesInServer.mockResolvedValue([
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
      mockProjectRepo.findByApiKey.mockResolvedValue(project);
      mockProjectRepo.findServerByName.mockResolvedValue({
        id: 'guild-by-name',
      });
      mockProjectRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectRepo.isRedirectUriAllowed.mockResolvedValue(true);

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
      mockProjectRepo.findByApiKey.mockResolvedValue(project);
      mockProjectRepo.findServerByName.mockResolvedValue(null);

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
      mockProjectRepo.findByApiKey.mockResolvedValue(project);
      mockProjectRepo.findMainServer.mockResolvedValue({ id: 'main-guild' });
      mockProjectRepo.isRedirectUriAllowed.mockResolvedValue(true);

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
      mockProjectRepo.findByApiKey.mockResolvedValue(project);
      mockProjectRepo.hasServerAccess.mockResolvedValue(true);
      await expect(
        service.validateLoginRequest('pk_good.secret', 'guild-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when redirect URI is not on the allowlist', async () => {
      const project = fakeProject({ isInternal: false });
      mockProjectRepo.findByApiKey.mockResolvedValue(project);
      mockProjectRepo.hasServerAccess.mockResolvedValue(true);
      mockProjectRepo.isRedirectUriAllowed.mockResolvedValue(false);

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
    function mockHttpResult<T>(data: T, ok = true, status = 200, text = '') {
      return {
        ok,
        status,
        data,
        text,
      };
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

      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ error: 'invalid_code' }, false, 400),
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

      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({}, false, 401),
      );

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

      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice' }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ message: '404: Not Found' }, false, 404, 'not found'),
      );

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('not_in_server'),
      });
    });

    it('returns detailed not_in_server message when guild member endpoint returns 403', async () => {
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
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice' }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ message: 'forbidden' }, false, 403, 'forbidden'),
      );

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result).toMatchObject({
        url: expect.stringContaining('not_in_server'),
      });
      expect(result.url).toContain('Missing+guild+access');
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
      mockProjectRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectRepo.findAllowedRoleIds.mockResolvedValue(['role-required']);
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice', email: null }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: ['role-other'] }),
      );
      mockDiscordHttpClient.fetchGuildRoles.mockResolvedValue(
        mockHttpResult([
          { id: 'role-other', name: 'Other', color: 0, position: 1 },
        ]),
      );

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({
        url: expect.stringContaining('insufficient_roles'),
      });
    });

    it('syncs only member roles that exist in guild role list', async () => {
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
      mockProjectRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectRepo.findAllowedRoleIds.mockResolvedValue([]);
      mockSessionRepo.create.mockResolvedValue(undefined);
      mockProjectRepo.getMemberRolesInServer.mockResolvedValue([]);
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({
          id: 'user-1',
          username: 'alice',
          global_name: null,
          display_name: null,
          avatar: null,
          email: null,
        }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: ['role-kept', 'role-unknown'] }),
      );
      mockDiscordHttpClient.fetchGuildRoles.mockResolvedValue(
        mockHttpResult([
          { id: 'role-kept', name: 'Member', color: 0, position: 1 },
          { id: 'role-other', name: 'Other', color: 2, position: 5 },
        ]),
      );

      await service.handleDiscordCallback('code', 'state');

      expect(mockProjectRepo.syncMemberServerData).toHaveBeenCalledWith(
        'user-1',
        'guild-1',
        [{ id: 'role-kept', name: 'Member', color: 0, position: 1 }],
      );
    });

    it('continues role check when guild roles fetch fails', async () => {
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
      mockProjectRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectRepo.findAllowedRoleIds.mockResolvedValue(['role-required']);
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice', email: null }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: ['role-required'] }),
      );
      mockDiscordHttpClient.fetchGuildRoles.mockResolvedValue(
        mockHttpResult({}, false, 500, 'server error'),
      );
      mockSessionRepo.create.mockResolvedValue(undefined);
      mockProjectRepo.getMemberRolesInServer.mockResolvedValue([]);

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result).toMatchObject({ url: expect.stringContaining('token=') });
      expect(mockProjectRepo.syncMemberServerData).toHaveBeenCalledWith(
        'user-1',
        'guild-1',
        [],
      );
    });

    it('treats malformed guild roles payload as empty role sync set', async () => {
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
      mockProjectRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectRepo.findAllowedRoleIds.mockResolvedValue([]);
      mockSessionRepo.create.mockResolvedValue(undefined);
      mockProjectRepo.getMemberRolesInServer.mockResolvedValue([]);
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice', email: null }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: ['role-required'] }),
      );
      mockDiscordHttpClient.fetchGuildRoles.mockResolvedValue(
        mockHttpResult({ roles: 'invalid-shape' } as any),
      );

      await service.handleDiscordCallback('code', 'state');

      expect(mockProjectRepo.syncMemberServerData).toHaveBeenCalledWith(
        'user-1',
        'guild-1',
        [],
      );
    });

    it('bubbles syncMemberServerData failures as callback errors', async () => {
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
      mockProjectRepo.syncMemberServerData.mockRejectedValue(
        new Error('sync failed'),
      );
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice' }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: [] }),
      );

      await expect(
        service.handleDiscordCallback('code', 'state'),
      ).rejects.toThrow('sync failed');
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
      mockProjectRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectRepo.findAllowedRoleIds.mockResolvedValue([]); // no role restriction
      mockSessionRepo.create.mockResolvedValue(undefined);
      mockProjectRepo.getMemberRolesInServer.mockResolvedValue([
        { name: 'Member' },
      ]);
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({
          id: 'user-1',
          username: 'alice',
          global_name: null,
          display_name: null,
          avatar: null,
          email: null,
        }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: [] }),
      );

      const result = await service.handleDiscordCallback('code', 'state');
      expect(result).toMatchObject({ url: expect.stringContaining('token=') });
      expect(mockSessionRepo.create).toHaveBeenCalled();
    });

    it('supports mixed roles and grants access when one required role is present', async () => {
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
      mockProjectRepo.syncMemberServerData.mockResolvedValue(undefined);
      mockProjectRepo.findAllowedRoleIds.mockResolvedValue(['role-allowed']);
      mockSessionRepo.create.mockResolvedValue(undefined);
      mockProjectRepo.getMemberRolesInServer.mockResolvedValue([]);
      mockDiscordHttpClient.exchangeCodeForToken.mockResolvedValue(
        mockHttpResult({ access_token: 'acc-tok' }),
      );
      mockDiscordHttpClient.fetchUserProfile.mockResolvedValue(
        mockHttpResult({ id: 'user-1', username: 'alice' }),
      );
      mockDiscordHttpClient.fetchGuildMember.mockResolvedValue(
        mockHttpResult({ roles: ['role-other', 'role-allowed'] }),
      );
      mockDiscordHttpClient.fetchGuildRoles.mockResolvedValue(
        mockHttpResult([
          { id: 'role-allowed', name: 'Lead', color: 1, position: 10 },
        ]),
      );

      const result = await service.handleDiscordCallback('code', 'state');

      expect(result.url).toContain('token=');
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
      expect(mockProjectRepo.getMemberRolesInServer).not.toHaveBeenCalled();
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
    it('calls deleteExpired on both session and oauth state repos', async () => {
      mockSessionRepo.deleteExpired.mockResolvedValue(undefined);
      mockOAuthStateRepo.deleteExpired.mockResolvedValue(undefined);

      const result = await service.cleanupExpired();
      expect(result).toEqual({ success: true });
      expect(mockSessionRepo.deleteExpired).toHaveBeenCalled();
      expect(mockOAuthStateRepo.deleteExpired).toHaveBeenCalled();
    });
  });
});
