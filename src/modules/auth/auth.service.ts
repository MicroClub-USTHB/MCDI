import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { ProjectRepository } from './repositories/project.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { ProjectsAccessRepository } from '../projects/projects-access.repository';
import { randomBytes } from 'crypto';
import {
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

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly oauthStateRepository: OAuthStateRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly projectsAccessRepository: ProjectsAccessRepository,
    private readonly configService: ConfigService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordClientSecret = this.configService.get<string>(
      'discord.clientSecret',
    )!;
    this.discordRedirectUri = this.configService.get<string>(
      'discord.redirectUri',
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
      this.projectRepository,
      apiKey,
    );

    // Determine target server
    let targetServerId: string;

    if (project.isInternal) {
      const mainServer = await this.projectRepository.findMainServer();
      if (!mainServer) {
        throw new BadRequestException('Main server not configured');
      }
      targetServerId = mainServer.id;
    } else {
      // External platforms: resolve serverId from serverName if provided
      if (!serverId && serverName) {
        const server =
          await this.projectRepository.findServerByName(serverName);
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
      const hasAccess = await this.projectsAccessRepository.hasServerAccess(
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

  // ─── Step 2 — Build Discord OAuth URL ────────────────────

  /**
   * Build the Discord OAuth URL with project context encoded in state.
   * Called when the user clicks "Login with Discord" on the MCDI page.
   * State is stored in DB for one-time use with 10-minute expiration.
   */
  async buildDiscordLoginUrl(
    projectId: string,
    apiKey: string,
    serverId: string,
    redirectUri: string,
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
      apiKey,
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

  // ─── Step 3 — Discord callback → session → redirect ─────

  /**
   * Handle the callback from Discord after user authorization.
   * This is the core step: it does everything in one shot.
   *
   * Flow:
   *  1. Validate state token (one-time use, not expired)
   *  2. Exchange Discord code for access token
   *  3. Fetch Discord profile (identify + email)
   *  4. Upsert member in DB
   *  5. Verify user is in the target Discord server
   *  6. Check role-based access for the project
   *  7. Create session token (30 days)
   *  8. Redirect back to platform with token + member + roles
   */
  async handleDiscordCallback(discordCode: string, stateToken: string) {
    // 1. Validate state token (checks if unused and not expired)
    const stateData =
      await this.oauthStateRepository.findValidState(stateToken);

    if (!stateData) {
      // Return generic error to prevent state enumeration attacks
      const fallbackUri =
        this.configService.get<string>('app.baseUrl') + '/error';
      return buildErrorRedirect(
        fallbackUri,
        'invalid_state',
        'Invalid or expired authentication request',
      );
    }

    // Mark state as used immediately to prevent replay attacks
    await this.oauthStateRepository.markAsUsed(stateToken);

    // Extract project context from state
    const { projectId, serverId, redirectUri } = stateData;

    // 2. Exchange Discord code for tokens
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.discordClientId,
        client_secret: this.discordClientSecret,
        grant_type: 'authorization_code',
        code: discordCode,
        redirect_uri: this.discordRedirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return buildErrorRedirect(
        redirectUri,
        'discord_error',
        'Failed to authenticate with Discord',
      );
    }

    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token: string;
    };

    // 3. Fetch Discord profile
    const profileRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return buildErrorRedirect(
        redirectUri,
        'profile_error',
        'Failed to fetch Discord profile',
      );
    }

    const profile = (await profileRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      display_name?: string | null;
      avatar?: string | null;
      email?: string | null;
    };

    // 4. Upsert member
    const member = await this.memberRepository.upsert({
      id: profile.id,
      username: profile.username,
      globalName: profile.global_name || undefined,
      displayName: profile.display_name || profile.global_name || undefined,
      avatar: profile.avatar || undefined,
      email: profile.email || undefined,
      syncedAt: new Date(),
    });

    // 5. Verify server membership via Discord API
    const guildMemberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${serverId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!guildMemberRes.ok) {
      const errBody = await guildMemberRes.text().catch(() => '');
      this.logger.error(
        `Guild member check failed for user=${profile.id} server=${serverId} ` +
          `status=${guildMemberRes.status} body=${errBody}`,
      );
      // status 404 → user not in server; 403 → missing scope or bot not in guild
      const reason =
        guildMemberRes.status === 403
          ? `Missing guild access (scope or bot not in server). Discord status: 403`
          : `You must be a member of the required Discord server (ID: ${serverId})`;
      return buildErrorRedirect(redirectUri, 'not_in_server', reason);
    }

    const guildMemberData = (await guildMemberRes.json()) as {
      roles?: string[];
    };
    const userDiscordRoleIds: string[] = guildMemberData.roles ?? [];

    // 5b. Fetch full role objects from Discord to get name/color/position,
    //     then sync the member's server membership + roles into MCDI DB.
    let discordRolesForSync: {
      id: string;
      name: string;
      color?: number;
      position?: number;
    }[] = [];
    if (userDiscordRoleIds.length > 0) {
      const guildRolesRes = await fetch(
        `https://discord.com/api/guilds/${serverId}/roles`,
        {
          headers: {
            Authorization: `Bot ${this.configService.get<string>('discord.token')}`,
          },
        },
      );
      if (guildRolesRes.ok) {
        const allGuildRoles = (await guildRolesRes.json()) as {
          id: string;
          name: string;
          color: number;
          position: number;
        }[];
        discordRolesForSync = allGuildRoles.filter((r) =>
          userDiscordRoleIds.includes(r.id),
        );
      }
    }
    await this.memberRepository.syncMemberServerData(
      member.id,
      serverId,
      discordRolesForSync,
    );

    // 6. Check role-based access
    const allowedRoleIds =
      await this.projectsRepository.findAllowedRoleIds(projectId);

    if (allowedRoleIds.length > 0) {
      const hasRole = userDiscordRoleIds.some((r) =>
        allowedRoleIds.includes(r),
      );
      if (!hasRole) {
        return buildErrorRedirect(
          redirectUri,
          'insufficient_roles',
          'You do not have the required roles to access this platform',
        );
      }
    }

    // 7. Create session token (30 days)
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.sessionRepository.create({
      memberId: member.id,
      projectId: projectId,
      serverId: serverId,
      token,
      expiresAt,
    });

    // 8. Get member's roles in the server (from our DB)
    const roles = await this.projectRepository.getMemberRolesInServer(
      member.id,
      serverId,
    );

    // 9. Redirect back to platform with token + member + roles
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('expires_at', expiresAt.toISOString());
    redirectUrl.searchParams.set(
      'member',
      JSON.stringify({
        id: member.id,
        username: member.username,
        globalName: member.globalName,
        displayName: member.displayName,
        avatar: member.avatar,
        email: member.email,
      }),
    );
    redirectUrl.searchParams.set('roles', JSON.stringify(roles));

    return { url: redirectUrl.toString() };
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
      ? await this.projectRepository.getMemberRolesInServer(
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
    ]);
    return { success: true };
  }
}
