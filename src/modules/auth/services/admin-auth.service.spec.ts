import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from './admin-auth.service';
import { SessionRepository } from '../repositories/session.repository';
import { MemberRepository } from '../repositories/member.repository';
import { AdminOAuthStateRepository } from '../repositories/admin-oauth-state.repository';
import { DiscordIdentityService } from './discord-identity.service';
import { SessionIssuanceService } from './session-issuance.service';
import { DiscordService } from '../../discord/discord.service';
import { AuditService } from '../../audit/audit.service';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let memberRepository: jest.Mocked<MemberRepository>;
  let adminOAuthStateRepository: jest.Mocked<AdminOAuthStateRepository>;
  let discordIdentityService: jest.Mocked<DiscordIdentityService>;
  let sessionIssuanceService: jest.Mocked<SessionIssuanceService>;
  let discordService: jest.Mocked<DiscordService>;
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    const mockSessionRepo = {
      findValidByToken: jest.fn(),
    };
    const mockMemberRepo = {
      findById: jest.fn(),
      syncMemberServerData: jest.fn(),
    };
    const mockAdminOAuthRepo = {
      create: jest.fn(),
      findValidState: jest.fn(),
      consumeValid: jest.fn(),
      markAsUsed: jest.fn(),
    };
    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'discord.clientId') return 'client-id';
        if (key === 'discord.adminRedirectUri')
          return 'http://localhost/api/auth/discord/callback';
        if (key === 'discord.mainGuildId') return 'guild-1';
        if (key === 'discord.executiveRoleId') return 'role-exec';
        return null;
      }),
    };
    const mockDiscordIdentity = {
      exchangeCodeForAccessToken: jest.fn(),
      resolveIdentityFromAccessToken: jest.fn(),
    };
    const mockSessionIssuance = {
      issueSession: jest.fn(),
    };
    const mockDiscordService = {
      fetchOAuthGuildMember: jest.fn(),
      fetchGuildRolesForMember: jest.fn(),
    };
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: SessionRepository, useValue: mockSessionRepo },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: AdminOAuthStateRepository, useValue: mockAdminOAuthRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DiscordIdentityService, useValue: mockDiscordIdentity },
        { provide: SessionIssuanceService, useValue: mockSessionIssuance },
        { provide: DiscordService, useValue: mockDiscordService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(AdminAuthService);
    sessionRepository = module.get(SessionRepository);
    memberRepository = module.get(MemberRepository);
    adminOAuthStateRepository = module.get(AdminOAuthStateRepository);
    discordIdentityService = module.get(DiscordIdentityService);
    sessionIssuanceService = module.get(SessionIssuanceService);
    discordService = module.get(DiscordService);
  });

  describe('getMe', () => {
    it('throws Unauthorized if session invalid', async () => {
      sessionRepository.findValidByToken.mockResolvedValue(null);
      await expect(service.getMe('t')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if member not found', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({
        memberId: '1',
      } as any);
      memberRepository.findById.mockResolvedValue(null);
      await expect(service.getMe('t')).rejects.toThrow(UnauthorizedException);
    });

    it('returns member on success', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({
        memberId: '1',
        expiresAt: new Date(),
      } as any);
      memberRepository.findById.mockResolvedValue({
        id: '1',
        username: 'a',
      } as any);

      const res = await service.getMe('t');

      expect(res.id).toBe('1');
    });
  });

  describe('buildAdminDiscordLoginUrl', () => {
    it('creates state and returns url', async () => {
      adminOAuthStateRepository.create.mockResolvedValue(undefined as any);

      const res = await service.buildAdminDiscordLoginUrl();

      expect(res.url).toContain('client-id');
      expect(res.url).toContain(
        encodeURIComponent('http://localhost/api/auth/discord/callback'),
      );
      expect(adminOAuthStateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('hasValidAdminState', () => {
    it('returns true when the state exists', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue({} as any);

      await expect(service.hasValidAdminState('valid')).resolves.toBe(true);
    });

    it('returns false when the state does not exist', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue(null);

      await expect(service.hasValidAdminState('missing')).resolves.toBe(false);
    });
  });

  describe('handleAdminDiscordCallback', () => {
    beforeEach(() => {
      adminOAuthStateRepository.consumeValid.mockResolvedValue({
        state: 'valid',
      } as any);
      discordIdentityService.exchangeCodeForAccessToken.mockResolvedValue(
        'acc_tok',
      );
      discordIdentityService.resolveIdentityFromAccessToken.mockResolvedValue({
        profile: { id: 'discord123', username: 'admin' },
        member: {
          id: 'discord123',
          username: 'admin',
          displayName: 'Admin User',
          isSystemAdmin: true,
        },
      } as any);
      discordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: true,
        roleIds: ['role-exec'],
      } as any);
      discordService.fetchGuildRolesForMember.mockResolvedValue([
        { id: 'role-exec', name: 'Executive' },
      ] as any);
      sessionIssuanceService.issueSession.mockResolvedValue({
        token: 'issued-token',
        expiresAt: new Date(),
      } as any);
    });

    it('throws Unauthorized if state is invalid', async () => {
      adminOAuthStateRepository.consumeValid.mockResolvedValue(null);

      await expect(
        service.handleAdminDiscordCallback('code', 'invalid'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if Discord token exchange fails', async () => {
      discordIdentityService.exchangeCodeForAccessToken.mockResolvedValue(null);

      await expect(
        service.handleAdminDiscordCallback('code', 'valid'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if Discord profile fetch fails', async () => {
      discordIdentityService.resolveIdentityFromAccessToken.mockResolvedValue(
        null,
      );

      await expect(
        service.handleAdminDiscordCallback('code', 'valid'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Forbidden if the member is not in the main guild', async () => {
      discordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(
        service.handleAdminDiscordCallback('code', 'valid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws Forbidden if the member lacks the Executive role', async () => {
      discordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: true,
        roleIds: ['role-lead'],
      } as any);

      await expect(
        service.handleAdminDiscordCallback('code', 'valid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('records a failed login with the reason, and with the Discord id once the profile resolved', async () => {
      adminOAuthStateRepository.consumeValid.mockResolvedValueOnce(null);
      await expect(
        service.handleAdminDiscordCallback('code', 'invalid', {
          ipAddress: '203.0.113.7',
          userAgent: 'jest',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: null,
          actionType: 'auth',
          action: 'login_failed',
          severity: 'warning',
          ipAddress: '203.0.113.7',
          details: {
            reason: 'Invalid or expired authentication request',
            attemptedActor: null,
          },
        }),
      );

      discordService.fetchOAuthGuildMember.mockResolvedValue({
        ok: true,
        roleIds: ['role-lead'],
      } as any);
      await expect(
        service.handleAdminDiscordCallback('code', 'valid'),
      ).rejects.toThrow(ForbiddenException);

      expect(auditService.logAction).toHaveBeenLastCalledWith(
        expect.objectContaining({
          actorId: 'discord123',
          action: 'login_failed',
          details: {
            reason:
              'Only members with a configured admin role can access the admin panel',
            attemptedActor: 'discord123',
          },
        }),
      );
    });

    it('records the successful login against the member', async () => {
      await service.handleAdminDiscordCallback('code', 'valid', {
        ipAddress: '203.0.113.7',
        userAgent: 'jest',
      });

      expect(auditService.logAction).toHaveBeenCalledTimes(1);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'discord123',
          actionType: 'auth',
          action: 'login',
          severity: 'info',
          ipAddress: '203.0.113.7',
          userAgent: 'jest',
        }),
      );
    });

    it('returns token and member if successful', async () => {
      const res = await service.handleAdminDiscordCallback('code', 'valid');

      expect(res.token).toBe('issued-token');
      expect(res.member.username).toBe('admin');
      expect(res.member.displayName).toBe('Admin User');
      expect(memberRepository.syncMemberServerData).toHaveBeenCalledWith(
        'discord123',
        'guild-1',
        [{ id: 'role-exec', name: 'Executive' }],
      );
      expect(sessionIssuanceService.issueSession).toHaveBeenCalledWith({
        memberId: 'discord123',
        ttlSeconds: 24 * 60 * 60,
        clientUserAgent: null,
        clientIpAddress: null,
      });
    });
  });
});
