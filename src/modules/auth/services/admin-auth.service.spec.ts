import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from './admin-auth.service';
import { SessionRepository } from '../repositories/session.repository';
import { MemberRepository } from '../repositories/member.repository';
import { AdminOAuthStateRepository } from '../repositories/admin-oauth-state.repository';
import { DiscordService } from '../../discord/discord.service';
import { hash } from 'bcryptjs';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let memberRepository: jest.Mocked<MemberRepository>;
  let adminOAuthStateRepository: jest.Mocked<AdminOAuthStateRepository>;
  let configService: jest.Mocked<ConfigService>;
  let discordService: jest.Mocked<DiscordService>;

  beforeEach(async () => {
    const mockSessionRepo = {
      findValidByToken: jest.fn(),
      create: jest.fn(),
    };
    const mockMemberRepo = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      upsert: jest.fn(),
      setPasswordHash: jest.fn(),
    };
    const mockAdminOAuthRepo = {
      create: jest.fn(),
      findValidState: jest.fn(),
      markAsUsed: jest.fn(),
    };
    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'discord.clientId') return 'client-id';
        if (key === 'discord.clientSecret') return 'client-secret';
        if (key === 'discord.adminRedirectUri') return 'http://localhost/cb';
        return null;
      }),
    };
    const mockDiscord = {
      exchangeCodeForTokens: jest.fn(),
      getUserProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: SessionRepository, useValue: mockSessionRepo },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: AdminOAuthStateRepository, useValue: mockAdminOAuthRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: DiscordService, useValue: mockDiscord },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    sessionRepository = module.get(SessionRepository);
    memberRepository = module.get(MemberRepository);
    adminOAuthStateRepository = module.get(AdminOAuthStateRepository);
    configService = module.get(ConfigService);
    discordService = module.get(DiscordService);
  });

  describe('adminPasswordLogin', () => {
    it('throws Unauthorized if user not found', async () => {
      memberRepository.findByUsername.mockResolvedValue(null);
      await expect(service.adminPasswordLogin('u', 'p')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized if no passwordHash set', async () => {
      memberRepository.findByUsername.mockResolvedValue({ id: '1' } as any);
      await expect(service.adminPasswordLogin('u', 'p')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized on invalid password', async () => {
      memberRepository.findByUsername.mockResolvedValue({
        id: '1',
        passwordHash: await hash('realpass', 1),
      } as any);
      await expect(service.adminPasswordLogin('u', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Forbidden if not system admin', async () => {
      memberRepository.findByUsername.mockResolvedValue({
        id: '1',
        isSystemAdmin: false,
        passwordHash: await hash('realpass', 1),
      } as any);
      await expect(service.adminPasswordLogin('u', 'realpass')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns token on success', async () => {
      const mockMember = {
        id: '1',
        username: 'admin',
        isSystemAdmin: true,
        passwordHash: await hash('realpass', 1),
      };
      memberRepository.findByUsername.mockResolvedValue(mockMember as any);
      sessionRepository.create.mockResolvedValue({ token: 't' } as any);

      const result = await service.adminPasswordLogin('u', 'realpass');
      expect(result.token).toBeDefined();
      expect(result.member.username).toBe('admin');
    });
  });

  describe('getMe', () => {
    it('throws Unauthorized if session invalid', async () => {
      sessionRepository.findValidByToken.mockResolvedValue(null);
      await expect(service.getMe('t')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if member not found', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1' } as any);
      memberRepository.findById.mockResolvedValue(null);
      await expect(service.getMe('t')).rejects.toThrow(UnauthorizedException);
    });

    it('returns member on success', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1', expiresAt: new Date() } as any);
      memberRepository.findById.mockResolvedValue({ id: '1', username: 'a' } as any);
      const res = await service.getMe('t');
      expect(res.id).toBe('1');
    });
  });

  describe('setPassword', () => {
    it('throws Unauthorized if session invalid', async () => {
      sessionRepository.findValidByToken.mockResolvedValue(null);
      await expect(service.setPassword('t', undefined, 'new12345')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if member not found', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1' } as any);
      memberRepository.findById.mockResolvedValue(null);
      await expect(service.setPassword('t', undefined, 'new12345')).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequest if passwordHash exists but no currentPassword given', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1' } as any);
      memberRepository.findById.mockResolvedValue({
        id: '1',
        isSystemAdmin: true,
        passwordHash: 'hash',
      } as any);
      await expect(service.setPassword('t', undefined, 'new')).rejects.toThrow(BadRequestException);
    });

    it('throws Unauthorized if currentPassword does not match', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1' } as any);
      memberRepository.findById.mockResolvedValue({
        id: '1',
        isSystemAdmin: true,
        passwordHash: await hash('oldpass', 1),
      } as any);
      await expect(service.setPassword('t', 'wrong', 'new')).rejects.toThrow(UnauthorizedException);
    });

    it('updates password successfully if current password matches', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1' } as any);
      memberRepository.findById.mockResolvedValue({
        id: '1',
        isSystemAdmin: true,
        passwordHash: await hash('oldpass', 1),
      } as any);
      const res = await service.setPassword('t', 'oldpass', 'newPass123!');
      expect(res.message).toBe('Password updated successfully');
      expect(memberRepository.setPasswordHash).toHaveBeenCalledWith('1', expect.any(String));
    });

    it('updates password successfully on first setup', async () => {
      sessionRepository.findValidByToken.mockResolvedValue({ memberId: '1' } as any);
      memberRepository.findById.mockResolvedValue({
        id: '1',
        isSystemAdmin: true,
        passwordHash: null,
      } as any);
      const res = await service.setPassword('t', undefined, 'newPass123!');
      expect(res.message).toBe('Password updated successfully');
      expect(memberRepository.setPasswordHash).toHaveBeenCalledWith('1', expect.any(String));
    });
  });

  describe('buildAdminDiscordLoginUrl', () => {
    it('creates state and returns url', async () => {
      adminOAuthStateRepository.create.mockResolvedValue(undefined as any);
      
      const res = await service.buildAdminDiscordLoginUrl();
      
      expect(res.url).toContain('client-id');
      expect(res.url).toContain(encodeURIComponent('http://localhost/cb'));
      expect(adminOAuthStateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('handleAdminDiscordCallback', () => {
    let globalFetch: jest.SpyInstance;

    beforeEach(() => {
      globalFetch = jest.spyOn(global, 'fetch').mockImplementation();
    });

    afterEach(() => {
      globalFetch.mockRestore();
    });

    it('throws Unauthorized if state is invalid', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue(null);
      await expect(service.handleAdminDiscordCallback('code', 'invalid')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if Discord token exchange fails', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue({ state: 'valid' } as any);
      globalFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'error',
      } as any);

      await expect(service.handleAdminDiscordCallback('code', 'valid')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized if Discord profile fetch fails', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue({ state: 'valid' } as any);
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'acc_tok' }),
      } as any);
      globalFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as any);

      await expect(service.handleAdminDiscordCallback('code', 'valid')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Forbidden if member is not system admin', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue({ state: 'valid' } as any);
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'acc_tok' }),
      } as any);
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'discord123',
          username: 'user',
        }),
      } as any);
      memberRepository.upsert.mockResolvedValue({
        id: 'discord123',
        isSystemAdmin: false,
      } as any);

      await expect(service.handleAdminDiscordCallback('code', 'valid')).rejects.toThrow(ForbiddenException);
    });

    it('returns token and member if successful', async () => {
      adminOAuthStateRepository.findValidState.mockResolvedValue({ state: 'valid' } as any);
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'acc_tok' }),
      } as any);
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'discord123',
          username: 'admin',
          display_name: 'Admin User',
        }),
      } as any);
      memberRepository.upsert.mockResolvedValue({
        id: 'discord123',
        username: 'admin',
        displayName: 'Admin User',
        isSystemAdmin: true,
      } as any);
      sessionRepository.create.mockResolvedValue(undefined as any);

      const res = await service.handleAdminDiscordCallback('code', 'valid');
      expect(res.token).toBeDefined();
      expect(res.member.username).toBe('admin');
      expect(res.member.displayName).toBe('Admin User');
      expect(adminOAuthStateRepository.markAsUsed).toHaveBeenCalledWith('valid');
      expect(sessionRepository.create).toHaveBeenCalled();
    });
  });
});
