import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { DrizzleDB } from '../../../database/database.module';
import { generateRefreshToken } from '../../../common/utils/refresh-token.util';
import { SessionRepository } from '../repositories/session.repository';

interface IssueSessionInput {
  memberId: string;
  ttlSeconds: number;
  projectId?: string;
  serverId?: string;
  clientUserAgent?: string | null;
  clientIpAddress?: string | null;
}

@Injectable()
export class SessionIssuanceService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async issueSession(data: IssueSessionInput, tx?: DrizzleDB) {
    const token = randomBytes(48).toString('hex');
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.ttlSeconds);

    const session = await this.sessionRepository.create(
      {
        memberId: data.memberId,
        projectId: data.projectId,
        serverId: data.serverId,
        token,
        refreshToken,
        clientUserAgent: data.clientUserAgent,
        clientIpAddress: data.clientIpAddress,
        expiresAt,
      },
      tx,
    );

    return {
      token,
      refreshToken,
      expiresAt,
      session,
    };
  }
}
