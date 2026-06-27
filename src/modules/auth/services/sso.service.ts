import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import * as schema from '../../../database/entities';
import {
  generateSsoToken,
  hashSsoToken,
} from '../../../common/utils/sso-token.util';
import { MemberRepository } from '../repositories/member.repository';
import { SessionRepository } from '../repositories/session.repository';
import { SsoSessionRepository } from '../repositories/sso-session.repository';

export interface IssueSsoSessionResult {
  token: string;
  expiresAt: Date;
}

export interface SsoSessionStatus {
  ssoSession: typeof schema.ssoSessions.$inferSelect;
  member: typeof schema.members.$inferSelect;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly ssoTtlSec: number;

  constructor(
    private readonly ssoSessionRepository: SsoSessionRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {
    this.ssoTtlSec = this.configService.get<number>('app.ssoTtlSec')!;
  }

  /**
   * Issue a new global SSO session for a member. Called from the Discord
   * callback path after the member has successfully authenticated.
   */
  async issueSession(memberId: string): Promise<IssueSsoSessionResult> {
    const token = generateSsoToken();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.ssoTtlSec);

    await this.ssoSessionRepository.create({
      memberId,
      token,
      expiresAt,
    });

    return { token, expiresAt };
  }

  /**
   * Resolve a plaintext SSO token to the SSO session + member profile.
   * Returns null if the cookie is missing, unknown, or expired.
   * Touches `last_used_at` on every hit so the listing endpoint can show
   * activity.
   */
  async resolveSession(token: string | null | undefined) {
    if (!token) return null;

    const ssoSession = await this.ssoSessionRepository.findValidByToken(token);
    if (!ssoSession) return null;

    const member = await this.memberRepository.findById(ssoSession.memberId);
    if (!member) {
      // Orphaned cookie — member was deleted. Treat as logged-out.
      return null;
    }

    // Fire-and-forget touch; we don't want failures here to break the request.
    this.ssoSessionRepository.touch(ssoSession.id).catch((err) => {
      this.logger.warn(`Failed to touch SSO session ${ssoSession.id}: ${err}`);
    });

    return { ssoSession, member };
  }

  /**
   * Destroy the global SSO session AND every project session for the same
   * member. This is the "log me out everywhere" button.
   */
  async logout(token: string) {
    const ssoSession = await this.ssoSessionRepository.findValidByToken(token);
    if (!ssoSession) {
      // Token is unknown or already expired — still safe to delete by hash.
      await this.ssoSessionRepository.deleteByToken(token);
      return;
    }

    await this.db.transaction(async (tx) => {
      await this.sessionRepository.deleteByMemberId(ssoSession.memberId, tx);
      await this.ssoSessionRepository.deleteByMemberId(ssoSession.memberId, tx);
    });
  }

  /**
   * List every active project session belonging to the SSO session's member,
   * joined with the project name. `lastUsedAt` is best-effort — the
   * `sessions` table does not yet track it, so we surface `createdAt` as a
   * stand-in. Tokens are never returned.
   */
  async listProjectSessions(memberId: string) {
    const now = new Date();
    const rows = await this.db
      .select({
        projectId: schema.sessions.projectId,
        projectName: schema.projects.name,
        serverId: schema.sessions.serverId,
        createdAt: schema.sessions.createdAt,
        expiresAt: schema.sessions.expiresAt,
      })
      .from(schema.sessions)
      .leftJoin(
        schema.projects,
        eq(schema.sessions.projectId, schema.projects.id),
      )
      .where(
        and(
          eq(schema.sessions.memberId, memberId),
          gt(schema.sessions.expiresAt, now),
        ),
      )
      .orderBy(desc(schema.sessions.createdAt))
      .limit(100);

    return {
      sessions: rows
        .filter((r) => r.projectId !== null && r.projectName !== null)
        .map((r) => ({
          projectId: r.projectId!,
          projectName: r.projectName!,
          serverId: r.serverId,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
          lastUsedAt: r.createdAt,
        })),
    };
  }

  /**
   * Look up the member's *current* role IDs in the target server, using
   * data already synced from Discord. Used by the SSO authorize path so we
   * can re-check `findAllowedRoleIds` without making the user re-OAuth.
   */
  async getMemberRoleIdsInServer(
    memberId: string,
    serverId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ roleId: schema.serverMemberRoles.roleId })
      .from(schema.serverMemberRoles)
      .innerJoin(
        schema.roles,
        eq(schema.serverMemberRoles.roleId, schema.roles.id),
      )
      .where(
        and(
          eq(schema.serverMemberRoles.memberId, memberId),
          eq(schema.roles.serverId, serverId),
        ),
      );
    return rows.map((r) => r.roleId);
  }
}
