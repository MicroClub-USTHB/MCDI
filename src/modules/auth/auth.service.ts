import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionRepository } from './session.repository';

@Injectable()
export class AuthService {
  constructor(private readonly sessions: SessionRepository) {}

  async validate(token: string, projectId: string) {
    const session = await this.sessions.findByTokenWithMember(token, projectId);
    if (!session) throw new UnauthorizedException('Invalid or expired session');
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }
    return { valid: true, memberId: session.memberId, expiresAt: session.expiresAt };
  }

  async logout(token: string, projectId: string) {
    const deleted = await this.sessions.deleteByToken(token, projectId);
    if (!deleted) throw new BadRequestException('Session not found');
    return { loggedOut: true };
  }

  async logoutAll(memberId: string, projectId: string) {
    const count = await this.sessions.deleteAllForMember(projectId, memberId);
    return { loggedOut: true, deleted: count };
  }
}
