import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../../../common/utils/refresh-token.util';
import { SessionRepository } from '../repositories/session.repository';

@Injectable()
export class SessionLifecycleService {
  private readonly sessionTtlSec: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService,
  ) {
    this.sessionTtlSec = this.configService.get<number>('app.sessionTtlSec')!;
  }

  /**
   * Rotate an active session's access and refresh tokens.
   *
   * Requires both the current (still-valid) access token and the matching
   * refresh token. Both are replaced and the expiry is extended, so the old
   * pair is invalidated the moment this returns.
   */
  async refresh(accessToken: string, refreshToken: string) {
    const session = await this.sessionRepository.findValidByToken(accessToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (
      !session.refreshTokenHash ||
      session.refreshTokenHash !== hashRefreshToken(refreshToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = randomBytes(48).toString('hex');
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.sessionTtlSec);

    const rotated = await this.sessionRepository.rotate(
      session.id,
      {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt,
      },
      session.refreshTokenHash,
    );

    if (!rotated) {
      // Lost a concurrent rotation: this refresh token was already consumed.
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: newAccessToken,
      expiresAt,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * List the member's active (non-expired) sessions, hiding token material.
   */
  async listActiveSessions(memberId: string) {
    const sessions =
      await this.sessionRepository.findActiveByMemberId(memberId);

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        serverId: s.serverId,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        clientInfo:
          s.clientUserAgent || s.clientIpAddress
            ? {
                userAgent: s.clientUserAgent,
                ipAddress: s.clientIpAddress,
              }
            : null,
      })),
    };
  }

  /**
   * Revoke one of the member's own sessions. A session that does not exist or
   * belongs to someone else is reported as not found so IDs cannot be probed.
   */
  async revokeSession(memberId: string, sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.memberId !== memberId) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepository.deleteById(sessionId);
  }
}
