import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from '../repositories/session.repository';
import { MemberRepository } from '../repositories/member.repository';
import { AdminOAuthStateRepository } from '../repositories/admin-oauth-state.repository';
import { AdminCliCodeRepository } from '../repositories/admin-cli-code.repository';
import { createHash, randomBytes } from 'crypto';
import {
  buildCliRedirect,
  buildDiscordOAuthUrl,
  isValidCodeChallenge,
  parseLoopbackRedirectUri,
  verifyCodeChallenge,
} from '../utils';
import { DiscordIdentityService } from './discord-identity.service';
import { SessionIssuanceService } from './session-issuance.service';
import { DiscordService } from '../../discord/discord.service';
import { AuditService } from '../../audit/audit.service';
import { AdminAccessService } from '../../admin-access/admin-access.service';
import {
  ACCESS_RESOURCES,
  type AccessLevel,
} from '../../../common/permissions/catalog';
import type { ClientInfo } from '../../../common/utils/client-info.util';

const ADMIN_SESSION_TTL_SEC = 24 * 60 * 60;

/** What a CLI (m-forge) passes to start an admin login it can receive itself. */
export interface AdminCliLoginRequest {
  redirectUri?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

type ResolvedIdentity = NonNullable<
  Awaited<ReturnType<DiscordIdentityService['resolveIdentityFromAccessToken']>>
>;

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly discordClientId: string;
  private readonly discordAdminRedirectUri: string;
  private readonly mainGuildId: string;
  private readonly cliCodeTtlSec: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly adminOAuthStateRepository: AdminOAuthStateRepository,
    private readonly adminCliCodeRepository: AdminCliCodeRepository,
    private readonly configService: ConfigService,
    private readonly discordIdentityService: DiscordIdentityService,
    private readonly sessionIssuanceService: SessionIssuanceService,
    private readonly discordService: DiscordService,
    private readonly auditService: AuditService,
    private readonly adminAccessService: AdminAccessService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordAdminRedirectUri = this.configService.get<string>(
      'discord.adminRedirectUri',
    )!;
    this.mainGuildId = this.configService.get<string>('discord.mainGuildId')!;
    this.cliCodeTtlSec =
      this.configService.get<number>('app.callbackCodeTtlSec') || 120;
  }

  // ─── System Admin Discord OAuth2 Login ───────────────────

  /**
   * Initiate the system admin Discord OAuth2 flow.
   *
   * Generates a one-time state token stored in `admin_oauth_states`,
   * then returns the Discord authorization URL. With a CLI request
   * (`redirect_uri` + PKCE S256 `code_challenge`), the state also records
   * where to hand the result back once Discord has been dealt with.
   */
  async buildAdminDiscordLoginUrl(cli: AdminCliLoginRequest = {}) {
    const cliLogin = this.parseCliLoginRequest(cli);
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10-minute window

    await this.adminOAuthStateRepository.create({
      state,
      expiresAt,
      ...cliLogin,
    });

    const url = buildDiscordOAuthUrl(
      this.discordClientId,
      this.discordAdminRedirectUri,
      state,
    );

    return { url };
  }

  /**
   * A CLI login needs both a loopback `redirect_uri` (RFC 8252) and a PKCE
   * S256 challenge (RFC 7636); anything partial or non-loopback is refused
   * rather than silently falling back to the web panel flow.
   */
  private parseCliLoginRequest(
    cli: AdminCliLoginRequest,
  ): { redirectUri: string; codeChallenge: string } | Record<string, never> {
    const { redirectUri, codeChallenge, codeChallengeMethod } = cli;
    if (
      redirectUri === undefined &&
      codeChallenge === undefined &&
      codeChallengeMethod === undefined
    ) {
      return {};
    }
    const loopback =
      redirectUri === undefined ? null : parseLoopbackRedirectUri(redirectUri);
    if (!loopback) {
      throw new BadRequestException(
        'redirect_uri must be an http loopback URL with a port (127.0.0.1, localhost or [::1])',
      );
    }
    if (codeChallengeMethod !== 'S256') {
      throw new BadRequestException(
        'code_challenge_method must be S256 for a CLI login',
      );
    }
    if (codeChallenge === undefined || !isValidCodeChallenge(codeChallenge)) {
      throw new BadRequestException(
        'code_challenge must be a 43-character base64url S256 challenge',
      );
    }
    return { redirectUri: loopback, codeChallenge };
  }

  async hasValidAdminState(stateToken: string): Promise<boolean> {
    const state =
      await this.adminOAuthStateRepository.findValidState(stateToken);
    return Boolean(state);
  }

  /**
   * The loopback URL a CLI login should be handed back to, or null for an
   * admin web panel login (or an unknown/expired state).
   */
  async findCliRedirect(stateToken: string): Promise<string | null> {
    const state =
      await this.adminOAuthStateRepository.findValidState(stateToken);
    return state?.redirectUri ?? null;
  }

  /**
   * Handle the Discord callback for the system admin flow.
   *
   * Flow:
   *  1. Validate & consume the admin state token
   *  2. Exchange the Discord code for an access token (using admin redirect URI)
   *  3. Fetch the Discord profile & upsert the member
   *  4. Verify the user is a member of the main MCDI guild
   *  5. Sync roles into the DB and clear the member's cached admin access
   *  6. Issue a 24-hour session token
   *  7. Return token + member info
   */
  async handleAdminDiscordCallback(
    discordCode: string,
    stateToken: string,
    clientInfo?: ClientInfo,
  ) {
    // 1. Validate & consume state token
    const stateData =
      await this.adminOAuthStateRepository.consumeValid(stateToken);

    if (!stateData) {
      throw this.rejectLogin(
        new UnauthorizedException('Invalid or expired authentication request'),
        clientInfo,
      );
    }

    // 2-5. Discord identity, main guild membership, role sync
    const member = await this.verifyAdminIdentity(discordCode, clientInfo);

    // 7. Issue a 24-hour session token
    const { token, expiresAt } = await this.sessionIssuanceService.issueSession(
      {
        memberId: member.id,
        ttlSeconds: ADMIN_SESSION_TTL_SEC,
        clientUserAgent: clientInfo?.userAgent ?? null,
        clientIpAddress: clientInfo?.ipAddress ?? null,
      },
    );

    this.auditService.logAction({
      actorId: member.id,
      actionType: 'auth',
      action: 'login',
      entityType: 'session',
      ipAddress: clientInfo?.ipAddress ?? null,
      userAgent: clientInfo?.userAgent ?? null,
      severity: 'info',
    });

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

  /**
   * Discord callback for a CLI login (m-forge). Runs the same checks as the
   * web panel login, but instead of a cookie it hands a one-time code back to
   * the CLI's loopback URL (`?code=&state=`); a refusal is handed back the
   * same way (`?error=&state=`) so the CLI can show it. The session itself is
   * only issued by `exchangeAdminCliCode`, against the PKCE verifier.
   *
   * Returns the URL to redirect the browser to.
   */
  async handleAdminCliCallback(
    discordCode: string,
    stateToken: string,
    clientInfo?: ClientInfo,
  ): Promise<string> {
    const stateData =
      await this.adminOAuthStateRepository.consumeValid(stateToken);

    // Without a valid CLI state there is no trusted URL to send anything to.
    if (!stateData?.redirectUri || !stateData.codeChallenge) {
      throw this.rejectLogin(
        new UnauthorizedException('Invalid or expired authentication request'),
        clientInfo,
      );
    }

    let member: ResolvedIdentity['member'];
    try {
      member = await this.verifyAdminIdentity(discordCode, clientInfo);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      return buildCliRedirect(stateData.redirectUri, {
        error: message,
        state: stateToken,
      });
    }

    const code = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.cliCodeTtlSec * 1000);
    await this.adminCliCodeRepository.create({
      codeHash: createHash('sha256').update(code).digest('hex'),
      memberId: member.id,
      codeChallenge: stateData.codeChallenge,
      expiresAt,
    });

    return buildCliRedirect(stateData.redirectUri, { code, state: stateToken });
  }

  /**
   * `POST /auth/admin/token`: exchanges a CLI login's one-time code for an
   * admin session, if `codeVerifier` matches the PKCE challenge the login
   * started with. The code is consumed either way, and every failure gives
   * the same answer so the endpoint can't be used to probe codes.
   */
  async exchangeAdminCliCode(
    code: string,
    codeVerifier: string,
    clientInfo?: ClientInfo,
  ) {
    const row = await this.adminCliCodeRepository.consumeValid(
      createHash('sha256').update(code).digest('hex'),
    );
    if (!row || !verifyCodeChallenge(codeVerifier, row.codeChallenge)) {
      throw this.rejectLogin(
        new UnauthorizedException('Invalid or expired login code'),
        clientInfo,
      );
    }

    const { token, expiresAt } = await this.sessionIssuanceService.issueSession(
      {
        memberId: row.memberId,
        ttlSeconds: ADMIN_SESSION_TTL_SEC,
        clientUserAgent: clientInfo?.userAgent ?? null,
        clientIpAddress: clientInfo?.ipAddress ?? null,
      },
    );

    this.auditService.logAction({
      actorId: row.memberId,
      actionType: 'auth',
      action: 'login',
      entityType: 'session',
      details: { via: 'cli' },
      ipAddress: clientInfo?.ipAddress ?? null,
      userAgent: clientInfo?.userAgent ?? null,
      severity: 'info',
    });

    return { token, expiresAt };
  }

  /**
   * Steps shared by the web panel and CLI logins: exchange the Discord code,
   * resolve the profile, require main-guild membership, and sync the
   * member's roles (clearing their cached admin access). Every refusal is
   * audited by `rejectLogin`.
   */
  private async verifyAdminIdentity(
    discordCode: string,
    clientInfo?: ClientInfo,
  ): Promise<ResolvedIdentity['member']> {
    // 2. Exchange Discord code for access token
    const accessToken =
      await this.discordIdentityService.exchangeCodeForAccessToken(
        discordCode,
        this.discordAdminRedirectUri,
      );

    if (!accessToken) {
      this.logger.error('Admin Discord token exchange failed');
      throw this.rejectLogin(
        new UnauthorizedException('Failed to authenticate with Discord'),
        clientInfo,
      );
    }

    // 3. Fetch Discord profile & upsert member
    const identity =
      await this.discordIdentityService.resolveIdentityFromAccessToken(
        accessToken,
      );

    if (!identity) {
      throw this.rejectLogin(
        new UnauthorizedException('Failed to fetch Discord profile'),
        clientInfo,
      );
    }

    const { profile, member } = identity;

    // 4. Verify main guild membership
    if (!this.mainGuildId) {
      this.logger.error('MC_GUILD_ID is not configured — admin login blocked');
      throw this.rejectLogin(
        new ForbiddenException(
          'Server configuration error: main guild not set',
        ),
        clientInfo,
        identity,
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
      throw this.rejectLogin(
        new ForbiddenException(
          'You must be a member of the main MCDI Discord server to access the admin panel',
        ),
        clientInfo,
        identity,
      );
    }

    const guildRoles = await this.discordService.fetchGuildRolesForMember(
      this.mainGuildId,
      guildMember.roleIds,
    );

    // 5. Sync roles into the DB so access checks see the current roles
    await this.memberRepository.syncMemberServerData(
      member.id,
      this.mainGuildId,
      guildRoles,
    );
    await this.adminAccessService.invalidateMember(member.id);

    return member;
  }

  // Writes the failed-login audit row and hands the exception back so the
  // call site can throw it. actorId is filled only once the Discord profile
  // resolved to a member row, because audit_logs.actor_id references
  // members.id; the Discord id goes into details as attemptedActor.
  private rejectLogin(
    exception: HttpException,
    clientInfo: ClientInfo | undefined,
    identity?: { profile: { id: string }; member: { id: string } },
  ): HttpException {
    this.auditService.logAction({
      actorId: identity?.member.id ?? null,
      actionType: 'auth',
      action: 'login_failed',
      entityType: 'session',
      details: {
        reason: exception.message,
        attemptedActor: identity?.profile.id ?? null,
      },
      ipAddress: clientInfo?.ipAddress ?? null,
      userAgent: clientInfo?.userAgent ?? null,
      severity: 'warning',
    });
    return exception;
  }

  // ─── GET /auth/admin/me ───────────────────────────────────────────────

  /**
   * Return the currently authenticated system admin's profile.
   * The token is already validated by AdminAccessGuard before reaching here.
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

    const { root, access } = await this.adminAccessService.getEffectiveAccess(
      member.id,
    );

    return {
      id: member.id,
      username: member.username,
      globalName: member.globalName,
      displayName: member.displayName,
      preferredName: member.preferredName,
      avatar: member.avatar,
      email: member.email,
      isSystemAdmin: member.isSystemAdmin,
      sessionExpiresAt: session.expiresAt,
      root,
      permissions: Object.fromEntries(
        ACCESS_RESOURCES.map((resource) => [resource, access[resource].level]),
      ) as Record<(typeof ACCESS_RESOURCES)[number], AccessLevel>,
    };
  }
}
