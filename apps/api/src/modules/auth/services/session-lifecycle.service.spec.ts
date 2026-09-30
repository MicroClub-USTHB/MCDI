import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionLifecycleService } from './session-lifecycle.service';
import { SessionRepository } from '../repositories/session.repository';
import { hashRefreshToken } from '../../../common/utils/refresh-token.util';

const mockSessionRepository = {
  findValidByToken: jest.fn(),
  rotate: jest.fn(),
  findActiveByMemberId: jest.fn(),
  findById: jest.fn(),
  deleteById: jest.fn(),
};

describe('SessionLifecycleService', () => {
  let service: SessionLifecycleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionLifecycleService,
        { provide: SessionRepository, useValue: mockSessionRepository },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'app.sessionTtlSec' ? 3600 : null,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(SessionLifecycleService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('refresh', () => {
    it('rotates both tokens and extends expiry on a valid pair', async () => {
      const refreshToken = 'valid-refresh';
      mockSessionRepository.findValidByToken.mockResolvedValue({
        id: 'sess-1',
        refreshTokenHash: hashRefreshToken(refreshToken),
      });
      mockSessionRepository.rotate.mockResolvedValue({ id: 'sess-1' });

      const before = Date.now();
      const result = await service.refresh('access-token', refreshToken);
      const after = Date.now();

      expect(result.accessToken).toMatch(/^[0-9a-f]{96}$/);
      expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/);
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 3_599_000,
      );
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 3_601_000);
      expect(mockSessionRepository.rotate).toHaveBeenCalledWith(
        'sess-1',
        {
          token: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        },
        hashRefreshToken(refreshToken),
      );
    });

    it('throws when a concurrent refresh already consumed the token', async () => {
      const refreshToken = 'valid-refresh';
      mockSessionRepository.findValidByToken.mockResolvedValue({
        id: 'sess-1',
        refreshTokenHash: hashRefreshToken(refreshToken),
      });
      mockSessionRepository.rotate.mockResolvedValue(null);

      await expect(
        service.refresh('access-token', refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when the access token has no valid session', async () => {
      mockSessionRepository.findValidByToken.mockResolvedValue(null);

      await expect(service.refresh('bad', 'whatever')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockSessionRepository.rotate).not.toHaveBeenCalled();
    });

    it('throws when the session carries no refresh token hash', async () => {
      mockSessionRepository.findValidByToken.mockResolvedValue({
        id: 'sess-1',
        refreshTokenHash: null,
      });

      await expect(service.refresh('access', 'refresh')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockSessionRepository.rotate).not.toHaveBeenCalled();
    });

    it('throws when the refresh token does not match', async () => {
      mockSessionRepository.findValidByToken.mockResolvedValue({
        id: 'sess-1',
        refreshTokenHash: hashRefreshToken('the-real-one'),
      });

      await expect(service.refresh('access', 'a-wrong-one')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockSessionRepository.rotate).not.toHaveBeenCalled();
    });
  });

  describe('listActiveSessions', () => {
    it('maps rows and folds client metadata into clientInfo', async () => {
      const createdAt = new Date('2026-06-22T10:00:00.000Z');
      const expiresAt = new Date('2026-06-29T10:00:00.000Z');
      mockSessionRepository.findActiveByMemberId.mockResolvedValue([
        {
          id: 's1',
          projectId: 'p1',
          serverId: 'g1',
          clientUserAgent: 'agent',
          clientIpAddress: '1.2.3.4',
          createdAt,
          expiresAt,
        },
        {
          id: 's2',
          projectId: null,
          serverId: null,
          clientUserAgent: null,
          clientIpAddress: null,
          createdAt,
          expiresAt,
        },
      ]);

      const result = await service.listActiveSessions('m1');

      expect(mockSessionRepository.findActiveByMemberId).toHaveBeenCalledWith(
        'm1',
      );
      expect(result.sessions).toEqual([
        {
          id: 's1',
          projectId: 'p1',
          serverId: 'g1',
          createdAt,
          expiresAt,
          clientInfo: { userAgent: 'agent', ipAddress: '1.2.3.4' },
        },
        {
          id: 's2',
          projectId: null,
          serverId: null,
          createdAt,
          expiresAt,
          clientInfo: null,
        },
      ]);
    });

    it('keeps clientInfo when only one field is present', async () => {
      mockSessionRepository.findActiveByMemberId.mockResolvedValue([
        {
          id: 's3',
          projectId: null,
          serverId: null,
          clientUserAgent: null,
          clientIpAddress: '9.9.9.9',
          createdAt: new Date(),
          expiresAt: new Date(),
        },
      ]);

      const result = await service.listActiveSessions('m1');

      expect(result.sessions[0].clientInfo).toEqual({
        userAgent: null,
        ipAddress: '9.9.9.9',
      });
    });
  });

  describe('revokeSession', () => {
    it('deletes a session the member owns', async () => {
      mockSessionRepository.findById.mockResolvedValue({
        id: 's1',
        memberId: 'm1',
      });

      await service.revokeSession('m1', 's1');

      expect(mockSessionRepository.deleteById).toHaveBeenCalledWith('s1');
    });

    it('throws NotFound when the session does not exist', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      await expect(service.revokeSession('m1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSessionRepository.deleteById).not.toHaveBeenCalled();
    });

    it('throws NotFound when the session belongs to another member', async () => {
      mockSessionRepository.findById.mockResolvedValue({
        id: 's1',
        memberId: 'someone-else',
      });

      await expect(service.revokeSession('m1', 's1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSessionRepository.deleteById).not.toHaveBeenCalled();
    });
  });
});
