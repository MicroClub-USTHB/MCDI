import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { AuthRequestRepository } from './repositories/auth-request.repository';
import { AdminOAuthStateRepository } from './repositories/admin-oauth-state.repository';
import {
  DiscordService,
  DiscordOAuthProfile,
} from '../discord/discord.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { randomBytes } from 'crypto';
import {
  buildDiscordOAuthUrl,
  buildErrorRedirect,
  buildSuccessPost,
} from './utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly discordClientId: string;
  private readonly discordRedirectUri: string;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly oauthStateRepository: OAuthStateRepository,
    private readonly authRequestRepository: AuthRequestRepository,
    private readonly adminOAuthStateRepository: AdminOAuthStateRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordRedirectUri = this.configService.get<string>(
      'discord.redirectUri',
    )!;
  }

  // ─── Authorization request ─────────────────────────────

  /**
   * Handle GET /auth/authorize — validates the client's params, creates
   * a short-lived auth request in the DB, and returns the request ID
   * (to be stored in a cookie by the controller).
   */
  async authorize(
    clientId: string,
    redirectUri: string,
    serverId: string,
    state: string,
  ): Promise<
    | { ok: true; requestId: string }
    | {
        ok: false;
        error: string;
        description: string;
        redirectUri?: string;
        state: string;
      }
  > {
    const project = await this.projectsRepository.findOne(clientId);
    if (!project || !project.isActive) {
      // Can't trust redirect_uri if the project is unknown or inactive
      return {
        ok: false,
        error: 'invalid_client',
        description: 'Unknown or inactive client_id',
        state,
      };
    }

    const isAllowed = await this.projectsRepository.isRedirectUriAllowed(
      project.id,
      redirectUri,
    );
    if (!isAllowed) {
      // Can't redirect to an unvalidated URI
      return {
        ok: false,
        error: 'invalid_redirect_uri',
        description: 'Redirect URI not allowed for this project',
        state,
      };
    }

    // redirect_uri is validated — errors from here can safely redirect back
    const hasAccess = await this.projectsRepository.hasServerAccess(
      project.id,
      serverId,
    );
    if (!hasAccess) {
      return {
        ok: false,
        error: 'access_denied',
        description: 'Project does not have access to this server',
        redirectUri,
        state,
      };
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const authRequest = await this.authRequestRepository.create({
      clientId: project.id,
      redirectUri,
      serverId,
      state,
      expiresAt,
    });

    return { ok: true, requestId: authRequest.requestId };
  }

  /**
   * Atomically find and consume an auth request.
   * Returns null if expired, already used, or not found.
   */
  async consumeAuthRequest(requestId: string) {
    return this.authRequestRepository.consumeValid(requestId);
  }

  /**
   * Look up any auth request by ID regardless of used/expired status.
   * Used to recover redirect_uri and state for error redirects.
   */
  async findAuthRequestById(requestId: string) {
    return this.authRequestRepository.findById(requestId);
  }

  // ─── Build Discord OAuth URL ──────────────────────────

  /**
   * Build the Discord OAuth URL with project context encoded in state.
   * Called when the user clicks "Login with Discord" on the MCDI page.
   * State is stored in DB for one-time use with 10-minute expiration.
   */
  async buildDiscordLoginUrl(
    projectId: string,
    serverId: string,
    redirectUri: string,
    clientState?: string,
  ) {
    // Generate secure random state token
    const state = randomBytes(32).toString('hex');

    // Store state in database with 10-minute expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.oauthStateRepository.create({
      state,
      projectId,
      serverId,
      redirectUri,
      clientState,
      expiresAt,
    });

    return {
      url: buildDiscordOAuthUrl(
        this.discordClientId,
        this.discordRedirectUri,
        state,
      ),
    };
  }

  // ─── Discord callback → session → redirect ─────────────

  /**
   * Handle the callback from Discord after user authorization.
   *
   * Validates the OAuth state, exchanges the code for an access token,
   * fetches the user profile, upserts the member, verifies guild membership,
   * checks role access, creates a 30-day session, and redirects back to
   * the platform with the token, member info, roles, and client state.
   */
  async handleDiscordCallback(discordCode: string, stateToken: string) {
    const stateResult = await this.validateAndConsumeState(stateToken);
    if (!stateResult.ok) return stateResult.redirect;
    const { projectId, serverId, redirectUri, clientState } = stateResult.data;

    const tokenResult = await this.exchangeCodeForToken(
      discordCode,
      redirectUri,
    );
    if (!tokenResult.ok) return tokenResult.redirect;
    const accessToken = tokenResult.data;

    const profileResult = await this.resolveDiscordProfile(
      accessToken,
      redirectUri,
    );
    if (!profileResult.ok) return profileResult.redirect;
    const profile = profileResult.data;

    const member = await this.upsertMemberFromProfile(profile);

    const guildResult = await this.verifyGuildAndSyncRoles(
      serverId,
      accessToken,
      profile.id,
      member.id,
      redirectUri,
    );
    if (!guildResult.ok) return guildResult.redirect;
    const userDiscordRoleIds = guildResult.data;

    const accessResult = await this.checkProjectRoleAccess(
      projectId,
      userDiscordRoleIds,
      redirectUri,
    );
    if (!accessResult.ok) return accessResult.redirect;

    const { token, expiresAt, roles } = await this.createSessionWithRoles(
      member.id,
      projectId,
      serverId,
    );

    return buildSuccessPost(
      redirectUri,
      token,
      expiresAt,
      {
        id: member.id,
        username: member.username,
        globalName: member.globalName,
        displayName: member.displayName,
        avatar: member.avatar,
        email: member.email,
      },
      roles,
      clientState,
    );
  }

  // ─── Validate & consume state token ─────────────────────

  private async validateAndConsumeState(stateToken: string) {
    const stateData =
      await this.oauthStateRepository.findValidState(stateToken);

    if (!stateData) {
      // Generic error to prevent state enumeration attacks
      const fallbackUri =
        this.configService.get<string>('app.baseUrl') + '/error';
      return {
        ok: false as const,
        redirect: buildErrorRedirect(
          fallbackUri,
          'invalid_state',
          'Invalid or expired authentication request',
        ),
      };
    }

    // Mark as used immediately to prevent replay attacks
    await this.oauthStateRepository.markAsUsed(stateToken);

    return { ok: true as const, data: stateData };
  }

  // ─── Exchange Discord code for access token ─────────────

  private async exchangeCodeForToken(code: string, redirectUri: string) {
    const accessToken = await this.discordService.exchangeOAuthCode(
      code,
      this.discordRedirectUri,
    );

    if (!accessToken) {
      return {
        ok: false as const,
        redirect: buildErrorRedirect(
          redirectUri,
          'discord_error',
          'Failed to authenticate with Discord',
        ),
      };
    }

    return { ok: true as const, data: accessToken };
  }

  // ─── Fetch Discord profile ───────────────────────────────

  private async resolveDiscordProfile(
    accessToken: string,
    redirectUri: string,
  ) {
    const profile = await this.discordService.fetchOAuthProfile(accessToken);

    if (!profile) {
      return {
        ok: false as const,
        redirect: buildErrorRedirect(
          redirectUri,
          'profile_error',
          'Failed to fetch Discord profile',
        ),
      };
    }

    return { ok: true as const, data: profile };
  }

  // ─── Upsert member ───────────────────────────────────────

  private async upsertMemberFromProfile(profile: DiscordOAuthProfile) {
    return this.memberRepository.upsert({
      id: profile.id,
      username: profile.username,
      globalName: profile.global_name || undefined,
      displayName: profile.display_name || profile.global_name || undefined,
      avatar: profile.avatar || undefined,
      email: profile.email || undefined,
      syncedAt: new Date(),
    });
  }

  // ─── Verify guild membership & sync roles ────────────────

  private async verifyGuildAndSyncRoles(
    serverId: string,
    accessToken: string,
    discordUserId: string,
    memberId: string,
    redirectUri: string,
  ) {
    const guildMember = await this.discordService.fetchOAuthGuildMember(
      serverId,
      accessToken,
    );

    if (!guildMember.ok) {
      this.logger.error(
        `Guild member check failed for user=${discordUserId} server=${serverId} status=${guildMember.status}`,
      );
      const reason =
        guildMember.status === 403
          ? `Missing guild access (scope or bot not in server). Discord status: 403`
          : `You must be a member of the required Discord server (ID: ${serverId})`;
      return {
        ok: false as const,
        redirect: buildErrorRedirect(redirectUri, 'not_in_server', reason),
      };
    }

    const discordRolesForSync =
      await this.discordService.fetchGuildRolesForMember(
        serverId,
        guildMember.roleIds,
      );

    await this.memberRepository.syncMemberServerData(
      memberId,
      serverId,
      discordRolesForSync,
    );

    return { ok: true as const, data: guildMember.roleIds };
  }

  // ─── Check project role access ──────────────────────────

  private async checkProjectRoleAccess(
    projectId: string,
    userDiscordRoleIds: string[],
    redirectUri: string,
  ) {
    const allowedRoleIds =
      await this.projectsRepository.findAllowedRoleIds(projectId);

    if (allowedRoleIds.length > 0) {
      const hasRole = userDiscordRoleIds.some((r) =>
        allowedRoleIds.includes(r),
      );
      if (!hasRole) {
        return {
          ok: false as const,
          redirect: buildErrorRedirect(
            redirectUri,
            'insufficient_roles',
            'You do not have the required roles to access this platform',
          ),
        };
      }
    }

    return { ok: true as const };
  }

  // ─── Create session & fetch DB roles ─────────────────────

  private async createSessionWithRoles(
    memberId: string,
    projectId: string,
    serverId: string,
  ) {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.sessionRepository.create({
      memberId,
      projectId,
      serverId,
      token,
      expiresAt,
    });

    const roles = await this.memberRepository.getMemberRolesInServer(
      memberId,
      serverId,
    );

    return { token, expiresAt, roles };
  }

  // ─── Validate session

  /**
   * Validate session token and return member + roles.
   * Platforms call this anytime to check if a token is still valid.
   */
  async validateSession(token: string) {
    const session = await this.sessionRepository.findByTokenWithMember(token);

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (new Date() > session.expiresAt) {
      await this.sessionRepository.deleteByToken(token);
      throw new UnauthorizedException('Session expired');
    }

    const roles = session.serverId
      ? await this.memberRepository.getMemberRolesInServer(
          session.memberId,
          session.serverId,
        )
      : [];

    return {
      member: session.member,
      roles,
    };
  }

  // ─── Logout

  async logout(token: string) {
    await this.sessionRepository.deleteByToken(token);
    return { success: true };
  }

  async logoutAll(memberId: string) {
    await this.sessionRepository.deleteByMemberId(memberId);
    return { success: true };
  }

  // ─── Maintenance ─────────────────────────────────────────

  async cleanupExpired() {
    await Promise.all([
      this.sessionRepository.deleteExpired(),
      this.oauthStateRepository.deleteExpired(),
      this.authRequestRepository.deleteExpired(),
      this.adminOAuthStateRepository.deleteExpired(),
    ]);
    return { success: true };
  }
}
