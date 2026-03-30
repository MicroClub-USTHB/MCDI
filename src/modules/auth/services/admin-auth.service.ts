import {
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
import { buildDiscordOAuthUrl } from '../utils';
import { DiscordIdentityService } from './discord-identity.service';
import { SessionIssuanceService } from './session-issuance.service';
import { DiscordService } from '../../discord/discord.service';

const ADMIN_SESSION_TTL_SEC = 24 * 60 * 60;
const EXECUTIVE_ROLE = 'Executive';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly discordClientId: string;
  private readonly discordAdminRedirectUri: string;
  private readonly mainGuildId: string;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly adminOAuthStateRepository: AdminOAuthStateRepository,
    private readonly configService: ConfigService,
    private readonly discordIdentityService: DiscordIdentityService,
    private readonly sessionIssuanceService: SessionIssuanceService,
    private readonly discordService: DiscordService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordAdminRedirectUri = this.configService.get<string>(
      'discord.adminRedirectUri',
    )!;
    this.mainGuildId = this.configService.get<string>('discord.mainGuildId')!;
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

  async hasValidAdminState(stateToken: string): Promise<boolean> {
    const state = await this.adminOAuthStateRepository.findValidState(
      stateToken,
    );
    return Boolean(state);
  }

  /**
   * Handle the Discord callback for the system admin flow.
   *
   * Flow:
   *  1. Validate & consume the admin state token
   *  2. Exchange the Discord code for an access token (using admin redirect URI)
   *  3. Fetch the Discord profile & upsert the member
   *  4. Verify the user is a member of the main MCDI guild
   *  5. Verify the user holds the "Executive" role in the main guild
   *  6. Sync roles into the DB
   *  7. Issue a 24-hour session token
   *  8. Return token + member info
   */
  async handleAdminDiscordCallback(discordCode: string, stateToken: string) {
    // 1. Validate & consume state token
    const stateData =
      await this.adminOAuthStateRepository.consumeValid(stateToken);

    if (!stateData) {
      throw new UnauthorizedException(
        'Invalid or expired authentication request',
      );
    }

    // 2. Exchange Discord code for access token
    const accessToken =
      await this.discordIdentityService.exchangeCodeForAccessToken(
        discordCode,
        this.discordAdminRedirectUri,
      );

    if (!accessToken) {
      this.logger.error('Admin Discord token exchange failed');
      throw new UnauthorizedException('Failed to authenticate with Discord');
    }

    // 3. Fetch Discord profile & upsert member
    const identity =
      await this.discordIdentityService.resolveIdentityFromAccessToken(
        accessToken,
      );

    if (!identity) {
      throw new UnauthorizedException('Failed to fetch Discord profile');
    }

    const { profile, member } = identity;

    // 4. Verify main guild membership
    if (!this.mainGuildId) {
      this.logger.error('MC_GUILD_ID is not configured — admin login blocked');
      throw new ForbiddenException(
        'Server configuration error: main guild not set',
      );
    }

    const guildMember = await this.discordService.fetchOAuthGuildMember(
      this.mainGuildId,
      accessToken,
    );

    if (!guildMember.ok) {
      this.logger.warn(
        `Admin login rejected: user ${profile.id} is not in the main guild (status ${guildMember.status})`,
      );
      throw new ForbiddenException(
        'You must be a member of the main MCDI Discord server to access the admin panel',
      );
    }

    // 5. Resolve role names & verify Executive role
    const guildRoles = await this.discordService.fetchGuildRolesForMember(
      this.mainGuildId,
      guildMember.roleIds,
    );

    const hasExecutiveRole = guildRoles.some((r) => r.name === EXECUTIVE_ROLE);

    if (!hasExecutiveRole) {
      this.logger.warn(
        `Admin login rejected: user ${profile.id} lacks the "${EXECUTIVE_ROLE}" role`,
      );
      throw new ForbiddenException(
        `Only members with the "${EXECUTIVE_ROLE}" role can access the admin panel`,
      );
    }

    // 6. Sync roles into the DB so guard checks work correctly
    await this.memberRepository.syncMemberServerData(
      member.id,
      this.mainGuildId,
      guildRoles,
    );

    // 7. Issue a 24-hour session token
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
}
