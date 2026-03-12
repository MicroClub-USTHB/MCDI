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
import { DiscordService } from '../../discord/discord.service';
import { randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { buildDiscordOAuthUrl } from '../utils';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly discordClientId: string;
  private readonly discordClientSecret: string;
  private readonly discordAdminRedirectUri: string;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly memberRepository: MemberRepository,
    private readonly adminOAuthStateRepository: AdminOAuthStateRepository,
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
  ) {
    this.discordClientId = this.configService.get<string>('discord.clientId')!;
    this.discordClientSecret = this.configService.get<string>(
      'discord.clientSecret',
    )!;
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

    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    await this.sessionRepository.create({
      memberId: member.id,
      token,
      expiresAt,
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
      await this.adminOAuthStateRepository.findValidState(stateToken);

    if (!stateData) {
      throw new UnauthorizedException(
        'Invalid or expired authentication request',
      );
    }

    await this.adminOAuthStateRepository.markAsUsed(stateToken);

    // 2. Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.discordClientId,
        client_secret: this.discordClientSecret,
        grant_type: 'authorization_code',
        code: discordCode,
        redirect_uri: this.discordAdminRedirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      this.logger.error(`Admin Discord token exchange failed: ${errBody}`);
      throw new UnauthorizedException('Failed to authenticate with Discord');
    }

    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token: string;
    };

    // 3. Fetch Discord profile
    const profileRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      throw new UnauthorizedException('Failed to fetch Discord profile');
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

    // 5. Check isSystemAdmin
    if (!member.isSystemAdmin) {
      throw new ForbiddenException(
        'Member does not have system admin privileges',
      );
    }

    // 6. Issue 24-hour session
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    await this.sessionRepository.create({
      memberId: member.id,
      token,
      expiresAt,
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
  }}