import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { AuthRequestRepository } from './repositories/auth-request.repository';
import { CallbackCodeRepository } from './repositories/callback-code.repository';
import { LoginTokenRepository } from './repositories/login-token.repository';
import { AdminOAuthStateRepository } from './repositories/admin-oauth-state.repository';
import {
  DiscordService,
  DiscordOAuthProfile,
} from '../discord/discord.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { ServersRepository } from '../servers/servers.repository';
import {
  buildCallbackCodeRedirect,
  buildDiscordOAuthUrl,
  buildErrorRedirect,
  validateApiKeyAndGetProject,
} from './utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly discordClientId: string;
  private readonly discordClientSecret: string;
  private readonly discordRedirectUri: string;
  private readonly discordAdminRedirectUri: string;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly authRequestRepository: AuthRequestRepository,
    private readonly callbackCodeRepository: CallbackCodeRepository,
    private readonly loginTokenRepository: LoginTokenRepository,
    private readonly adminOAuthStateRepository: AdminOAuthStateRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly serversRepository: ServersRepository,
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordClientSecret = this.configService.get<string>(
      'discord.clientSecret',
    )!;
    this.discordRedirectUri = this.configService.get<string>(
      'discord.redirectUri',
    )!;
    this.discordAdminRedirectUri = this.configService.get<string>(
      'discord.adminRedirectUri',
    )!;
  }

  // ─── Step 1 — Validate API key & render login page ───────

  /**
   * Validate the platform's API key and resolve the project context.
   * Called when a user lands on the MCDI login page.
   *
   * Flow:
   *  1. Look up the project by API key
   *  2. If external → serverId or serverName is required
   *  3. If internal → use main server
   *  4. Validate redirect URI against allowlist
   *  5. Check project has access to the target server
   *  6. Return project info so the login page can render
   */
  async validateLoginRequest(
    apiKey: string,
    serverId?: string,
    serverName?: string,
    redirectUri?: string,
  ) {
    const project = await validateApiKeyAndGetProject(
      this.projectsRepository,
      apiKey,
    );

    // Determine target server
    let targetServerId: string;

    if (project.isInternal) {
      const mainServer = await this.serversRepository.findMain();
      if (!mainServer) {
        throw new BadRequestException('Main server not configured');
      }
      targetServerId = mainServer.id;
    } else {
      // External platforms: resolve serverId from serverName if provided
      if (!serverId && serverName) {
        const server = await this.serversRepository.findByName(serverName);
        if (!server) {
          throw new BadRequestException(
            `Server with name "${serverName}" not found`,
          );
        }
        targetServerId = server.id;
      } else if (serverId) {
        targetServerId = serverId;
      } else {
        throw new BadRequestException(
          'serverId or serverName is required for external platforms',
        );
      }

      // Verify project has access to this server
      const hasAccess = await this.projectsRepository.hasServerAccess(
        project.id,
        targetServerId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'Project does not have access to this server',
        );
      }
    }

    // Resolve redirect URI
    const finalRedirectUri = redirectUri || project.redirectUri;
    if (!finalRedirectUri) {
      throw new BadRequestException(
        'No redirect URI configured for this project',
      );
    }

    // Validate redirect URI against allowlist
    const isAllowed = await this.projectsRepository.isRedirectUriAllowed(
      project.id,
      finalRedirectUri,
    );
    if (!isAllowed) {
      throw new ForbiddenException('Redirect URI not allowed for this project');
    }

    return {
      project,
      serverId: targetServerId,
      redirectUri: finalRedirectUri,
    };
  }

  // ─── Login session (secure two-step flow) ────────────────

  /**
   * Create a short-lived login token that encodes the project context.
   * The platform calls this server-to-server with the API key in a header,
   * then redirects the user's browser to the returned loginUrl.
   * This keeps the API key out of URLs entirely.
   */
  async createLoginSession(
    apiKey: string,
    serverId?: string,
    serverName?: string,
    redirectUri?: string,
    state?: string,
  ) {
    // Reuse existing validation logic
    const context = await this.validateLoginRequest(
      apiKey,
      serverId,
      serverName,
      redirectUri,
    );

    // Generate a short-lived token (5 minutes)
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.loginTokenRepository.create({
      token,
      projectId: context.project.id,
      serverId: context.serverId,
      redirectUri: context.redirectUri,
      state,
      expiresAt,
    });

    const baseUrl = this.configService.get<string>('app.baseUrl') || '';
    return {
      loginUrl: `${baseUrl}/api/auth/login/${token}`,
    };
  }

  /**
   * Resolve a login token to its stored project context.
   * Used by GET /auth/login/:token to render the login page.
   */
  async resolveLoginToken(token: string) {
    const loginToken = await this.loginTokenRepository.findValid(token);
    if (!loginToken) {
      return null;
    }
    const project = await this.projectsRepository.findOne(loginToken.projectId);
    return {
      ...loginToken,
      projectName: project?.name ?? loginToken.projectId,
    };
  }

  // ─── Step 2 — Build Discord OAuth URL ────────────────────

  /**
   * Build the Discord OAuth URL with project context stored in a one-time auth request.
   * Called when the user clicks "Login with Discord" on the MCDI page.
   * The request ID is sent to Discord as the OAuth state and mirrored into a secure cookie.
   */
  async buildDiscordLoginUrl(
    projectId: string,
    serverId: string,
    redirectUri: string,
    state?: string,
  ) {
    const requestId = randomBytes(32).toString('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.authRequestRepository.create({
      requestId,
      clientId: projectId,
      serverId,
      redirectUri,
      state,
      expiresAt,
    });

    return {
      requestId,
      url: buildDiscordOAuthUrl(
        this.discordClientId,
        this.discordRedirectUri,
        requestId,
      ),
    };
  }

  // ─── Step 3 — Discord callback → callback code → redirect ─

  /**
   * Handle the callback from Discord after user authorization.
   * This is the core step: it does everything in one shot.
   *
   * Flow:
   *  1. Validate auth request (one-time use, not expired)
   *  2. Exchange Discord code for access token
   *  3. Fetch Discord profile (identify + email)
   *  4. Upsert member in DB
   *  5. Verify user is in the target Discord server
   *  6. Check role-based access for the project
   *  7. Generate a short-lived callback code and store only its hash
   *  8. Redirect back to platform with the callback code + original state
   */
  async handleDiscordCallback(
    discordCode: string,
    requestId?: string,
    discordState?: string,
  ) {
    const authRequestResult = await this.validateAndConsumeAuthRequest(
      requestId,
      discordState,
    );
    if (!authRequestResult.ok) return authRequestResult.redirect;
    const { clientId, serverId, redirectUri, state } = authRequestResult.data;

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
      clientId,
      userDiscordRoleIds,
      redirectUri,
    );
    if (!accessResult.ok) return accessResult.redirect;

    const callbackCode = randomBytes(32).toString('hex');
    const callbackCodeHash = createHash('sha256')
      .update(callbackCode)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 90_000);

    await this.callbackCodeRepository.create({
      codeHash: callbackCodeHash,
      clientId,
      redirectUri,
      memberId: member.id,
      serverId,
      expiresAt,
    });

    return buildCallbackCodeRedirect(redirectUri, callbackCode, state);
  }

  // ─── Step 1 — Validate & consume auth request ─────────────

  private async validateAndConsumeAuthRequest(
    requestId?: string,
    discordState?: string,
  ) {
    if (!requestId) {
      const fallbackUri =
        this.configService.get<string>('app.baseUrl') + '/error';
      return {
        ok: false as const,
        redirect: buildErrorRedirect(
          fallbackUri,
          'invalid_state',
          'Authentication request was not found',
        ),
      };
    }

    const authRequest =
      await this.authRequestRepository.findValidRequest(requestId);

    if (!authRequest) {
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

    if (discordState && discordState !== requestId) {
      return {
        ok: false as const,
        redirect: buildErrorRedirect(
          authRequest.redirectUri,
          'invalid_state',
          'Authentication request did not match callback state',
        ),
      };
    }

    await this.authRequestRepository.markAsUsed(requestId);

    return { ok: true as const, data: authRequest };
  }

  // ─── Step 2 — Exchange Discord code for access token ─────

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

  // ─── Step 3 — Fetch Discord profile ──────────────────────

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

  // ─── Step 4 — Upsert member ───────────────────────────────

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

  // ─── Steps 5 + 5b — Verify guild membership & sync roles ─

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

  // ─── Step 6 — Check project role access ────────────────────

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

  // ─── Steps 7 + 8 — Create session & fetch DB roles ───────

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
      this.authRequestRepository.deleteExpired(),
      this.callbackCodeRepository.deleteExpired(),
      this.loginTokenRepository.deleteExpired(),
      this.adminOAuthStateRepository.deleteExpired(),
    ]);
    return { success: true };
  }
}
