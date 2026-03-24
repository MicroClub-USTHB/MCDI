import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from '../repositories/session.repository';
import { MemberRepository } from '../repositories/member.repository';
import { AdminOAuthStateRepository } from '../repositories/admin-oauth-state.repository';
import { randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { buildDiscordOAuthUrl } from '../utils';
import { DiscordIdentityService } from './discord-identity.service';
import { SessionIssuanceService } from './session-issuance.service';

const ADMIN_SESSION_TTL_SEC = 24 * 60 * 60;

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly discordClientId: string;
  private readonly discordAdminRedirectUri: string;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly adminOAuthStateRepository: AdminOAuthStateRepository,
    private readonly configService: ConfigService,
    private readonly discordIdentityService: DiscordIdentityService,
    private readonly sessionIssuanceService: SessionIssuanceService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordAdminRedirectUri = this.configService.get<string>(
      'discord.adminRedirectUri',
    )!;
  }

  /**
   *  1. Look up member by username
   *  2. Verify the bcryptjs password hash
   *  3. Confirm `isSystemAdmin = true`
   *  4. Issue a 24-hour session token
   */
  async adminPasswordLogin(username: string, password: string) {
    const member = await this.memberRepository.findByUsername(username);

    if (!member || !member.passwordHash) {
      // Constant-time guard: run a dummy compare to prevent timing attacks
      await compare(
        password,
        '$2b$10$invalidhashpaddingtostoptiming000000000000000000000000000',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await compare(password, member.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!member.isSystemAdmin) {
      throw new ForbiddenException(
        'Member does not have system admin privileges',
      );
    }

    const { token, expiresAt } = await this.sessionIssuanceService.issueSession(
      {
        memberId: member.id,
        ttlSeconds: ADMIN_SESSION_TTL_SEC,
      },
    );

    return {
      token,
      expiresAt,
      member: {
        id: member.id,
        username: member.username,
        globalName: member.globalName,
        displayName: member.displayName,
        avatar: member.avatar,
        email: member.email,
        isSystemAdmin: member.isSystemAdmin,
      },
    };
  }

  // ─── System Admin Discord OAuth2 Login ───────────────────

  /**
   * Initiate the system admin Discord OAuth2 flow.
   *
   * Generates a one-time state token stored in `admin_oauth_states`,
   * then returns the Discord authorization URL.
   */
  async buildAdminDiscordLoginUrl() {
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10-minute window

    await this.adminOAuthStateRepository.create({ state, expiresAt });

    const url = buildDiscordOAuthUrl(
      this.discordClientId,
      this.discordAdminRedirectUri,
      state,
    );

    return { url };
  }

  /**
   * Handle the Discord callback for the system admin flow.
   *
   * Flow:
   *  1. Validate & consume the admin state token
   *  2. Exchange the Discord code for an access token (using admin redirect URI)
   *  3. Fetch the Discord profile
   *  4. Upsert the member record
   *  5. Verify `isSystemAdmin = true`
   *  6. Issue a 24-hour session token
   *  7. Return token + member info
   */
  async handleAdminDiscordCallback(discordCode: string, stateToken: string) {
    // 1. Validate state
    const stateData =
      await this.adminOAuthStateRepository.consumeValid(stateToken);

    if (!stateData) {
      throw new UnauthorizedException(
        'Invalid or expired authentication request',
      );
    }

    const accessToken =
      await this.discordIdentityService.exchangeCodeForAccessToken(
        discordCode,
        this.discordAdminRedirectUri,
      );

    if (!accessToken) {
      this.logger.error('Admin Discord token exchange failed');
      throw new UnauthorizedException('Failed to authenticate with Discord');
    }

    const identity =
      await this.discordIdentityService.resolveIdentityFromAccessToken(
        accessToken,
      );

    if (!identity) {
      throw new UnauthorizedException('Failed to fetch Discord profile');
    }

    const { member } = identity;

    // 5. Check isSystemAdmin
    if (!member.isSystemAdmin) {
      throw new ForbiddenException(
        'Member does not have system admin privileges',
      );
    }

    const { token, expiresAt } = await this.sessionIssuanceService.issueSession(
      {
        memberId: member.id,
        ttlSeconds: ADMIN_SESSION_TTL_SEC,
      },
    );

    return {
      token,
      expiresAt,
      member: {
        id: member.id,
        username: member.username,
        globalName: member.globalName,
        displayName: member.displayName,
        avatar: member.avatar,
        email: member.email,
        isSystemAdmin: member.isSystemAdmin,
      },
    };
  }

  // ─── GET /auth/admin/me ───────────────────────────────────────────────

  /**
   * Return the currently authenticated system admin's profile.
   * The token is already validated by SystemAdminGuard before reaching here.
   */
  async getMe(token: string) {
    const session = await this.sessionRepository.findValidByToken(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const member = await this.memberRepository.findById(session.memberId);
    if (!member) {
      throw new UnauthorizedException('Member not found');
    }

    return {
      id: member.id,
      username: member.username,
      globalName: member.globalName,
      displayName: member.displayName,
      avatar: member.avatar,
      email: member.email,
      isSystemAdmin: member.isSystemAdmin,
      sessionExpiresAt: session.expiresAt,
    };
  }

  // ─── POST /auth/admin/set-password ───────────────────────────────────

  /**
   * Let a system admin set or change their own password.
   *
   * - If `passwordHash` is already set in DB → `currentPassword` is required and must match.
   * - On first call (no password yet) → `currentPassword` is optional.
   */
  async setPassword(
    token: string,
    currentPassword: string | undefined,
    newPassword: string,
  ) {
    const session = await this.sessionRepository.findValidByToken(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const member = await this.memberRepository.findById(session.memberId);
    if (!member) {
      throw new UnauthorizedException('Member not found');
    }

    // Require current password only when one is already set
    if (member.passwordHash) {
      if (!currentPassword) {
        throw new BadRequestException(
          'currentPassword is required when changing an existing password',
        );
      }
      const valid = await compare(currentPassword, member.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const newHash = await hash(newPassword, 10);
    await this.memberRepository.setPasswordHash(session.memberId, newHash);

    return { message: 'Password updated successfully' };
  }
}
