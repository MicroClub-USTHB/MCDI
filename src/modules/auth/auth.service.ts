import {
    Injectable,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { ProjectRepository } from './repositories/project.repository';
import { randomBytes } from 'crypto';
import { buildDiscordOAuthUrl, buildErrorRedirect, validateApiKeyAndGetProject } from './utils';

@Injectable()
export class AuthService {
    private readonly discordClientId: string;
    private readonly discordClientSecret: string;
    private readonly discordRedirectUri: string;

    constructor(
        private readonly sessionRepository: SessionRepository,
        private readonly memberRepository: MemberRepository,
        private readonly projectRepository: ProjectRepository,
        private readonly configService: ConfigService,
    ) {
        this.discordClientId = this.configService.get<string>('discord.clientId')!;
        this.discordClientSecret = this.configService.get<string>('discord.clientSecret')!;
        this.discordRedirectUri = this.configService.get<string>('discord.redirectUri')!;
    }

    // ─── Step 1 — Validate API key & render login page ───────

    /**
     * Validate the platform's API key and resolve the project context.
     * Called when a user lands on the MCDI login page.
     *
     * Flow:
     *  1. Look up the project by API key
     *  2. If external → serverId is required
     *  3. If internal → use main server
     *  4. Return project info so the login page can render
     */
    async validateLoginRequest(apiKey: string, serverId?: string, redirectUri?: string) {
        const project = await validateApiKeyAndGetProject(this.projectRepository, apiKey);

        // Determine target server
        let targetServerId: string;

        if (project.isInternal) {
            const mainServer = await this.projectRepository.findMainServer();
            if (!mainServer) {
                throw new BadRequestException('Main server not configured');
            }
            targetServerId = mainServer.id;
        } else {
            if (!serverId) {
                throw new BadRequestException(
                    'serverId is required for external platforms',
                );
            }
            targetServerId = serverId;
        }

        // Resolve redirect URI
        const finalRedirectUri = redirectUri || project.redirectUri;
        if (!finalRedirectUri) {
            throw new BadRequestException(
                'No redirect URI configured for this project',
            );
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
     */
    buildDiscordLoginUrl(projectId: string, apiKey: string, serverId: string, redirectUri: string) {
        const state = Buffer.from(
            JSON.stringify({ projectId, serverId, redirectUri, apiKey }),
        ).toString('base64url');

        return { url: buildDiscordOAuthUrl(this.discordClientId, this.discordRedirectUri, state) };
    }

    // ─── Step 3 — Discord callback → session → redirect ─────

    /**
     * Handle the callback from Discord after user authorization.
     * This is the core step: it does everything in one shot.
     *
     * Flow:
     *  1. Decode state → get projectId, serverId, redirectUri
     *  2. Exchange Discord code for access token
     *  3. Fetch Discord profile (identify + email)
     *  4. Upsert member in DB
     *  5. Verify user is in the target Discord server
     *  6. Check role-based access for the project
     *  7. Create session token (30 days)
     *  8. Redirect back to platform with token + member + roles
     */
    async handleDiscordCallback(discordCode: string, stateBase64: string) {
        // 1. Decode state
        let state: {
            projectId: string;
            serverId: string;
            redirectUri: string;
            apiKey: string;
        };
        try {
            state = JSON.parse(Buffer.from(stateBase64, 'base64url').toString());
        } catch {
            throw new BadRequestException('Invalid state parameter');
        }

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
            return buildErrorRedirect(state.redirectUri, 'discord_error', 'Failed to authenticate with Discord');
        }

        const { access_token: accessToken } = await tokenRes.json();

        // 3. Fetch Discord profile
        const profileRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!profileRes.ok) {
            return buildErrorRedirect(state.redirectUri, 'profile_error', 'Failed to fetch Discord profile');
        }

        const profile = await profileRes.json();

        // 4. Upsert member
        const member = await this.memberRepository.upsert({
            id: profile.id,
            username: profile.username,
            globalName: profile.global_name || null,
            displayName: profile.display_name || profile.global_name || null,
            avatar: profile.avatar || null,
            email: profile.email || null,
            syncedAt: new Date(),
        });

        // 5. Verify server membership via Discord API
        const guildMemberRes = await fetch(
            `https://discord.com/api/users/@me/guilds/${state.serverId}/member`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        if (!guildMemberRes.ok) {
            return buildErrorRedirect(state.redirectUri, 'not_in_server', 'You must be a member of the required Discord server');
        }

        const guildMemberData = await guildMemberRes.json();
        const userDiscordRoleIds: string[] = guildMemberData.roles || [];

        // 6. Check role-based access
        const allowedRoleIds = await this.projectRepository.findAllowedRoleIds(
            state.projectId,
        );

        if (allowedRoleIds.length > 0) {
            const hasRole = userDiscordRoleIds.some((r) => allowedRoleIds.includes(r));
            if (!hasRole) {
                return buildErrorRedirect(state.redirectUri, 'insufficient_roles', 'You do not have the required roles to access this platform');
            }
        }

        // 7. Create session token (30 days)
        const token = randomBytes(48).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await this.sessionRepository.create({
            memberId: member.id,
            projectId: state.projectId,
            serverId: state.serverId,
            token,
            expiresAt,
        });

        // 8. Get member's roles in the server (from our DB)
        const roles = await this.projectRepository.getMemberRolesInServer(
            member.id,
            state.serverId,
        );

        // 9. Redirect back to platform with token + member + roles
        const redirectUrl = new URL(state.redirectUri);
        redirectUrl.searchParams.set('token', token);
        redirectUrl.searchParams.set('expires_at', expiresAt.toISOString());
        redirectUrl.searchParams.set('member', JSON.stringify({
            id: member.id,
            username: member.username,
            globalName: member.globalName,
            displayName: member.displayName,
            avatar: member.avatar,
            email: member.email,
        }));
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
        ]);
        return { success: true };
    }
}
