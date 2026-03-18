import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { buildErrorPage } from './utils';
import { extractBearerToken } from '../../common/utils/auth.util';
import {
  ValidateSessionDto,
  LogoutDto,
  LogoutAllDto,
  ValidateSessionResponseDto,
  SuccessResponseDto,
  AuthorizeQueryDto,
  AdminPasswordLoginDto,
  AdminLoginResponseDto,
  SetPasswordDto,
  AdminMeResponseDto,
} from './dto';

type RequestWithProject = Request & { project?: { id: string } };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly apiPrefix: string;

  constructor(
    private readonly authService: AuthService,
    private readonly adminAuthService: AdminAuthService,
    private readonly configService: ConfigService,
  ) {
    this.apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
  }

  // ─── Authorization request ─────────────────────────────
  // Platform redirects user here with query params. MCDI validates, stores
  // the request in DB, sets a cookie, and redirects to Discord OAuth.

  @Get('authorize')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Initiate authorization request',
    description:
      'Standard OAuth-style authorization endpoint. The platform redirects the user here ' +
      'with `client_id`, `redirect_uri`, `server_id`, and `state` as query parameters.\n\n' +
      'MCDI validates the params, creates a short-lived auth request in the DB, ' +
      'sets an httpOnly cookie with the request ID, and redirects to Discord OAuth.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Discord OAuth authorization page.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid or missing query parameters.',
  })
  @ApiForbiddenResponse({
    description:
      'Project inactive, redirect URI not allowed, or server not accessible.',
  })
  async authorize(@Query() dto: AuthorizeQueryDto, @Res() res: Response) {
    const result = await this.authService.authorize(
      dto.client_id,
      dto.redirect_uri,
      dto.server_id,
      dto.state,
    );

    if (!result.ok) {
      // If redirect_uri was validated, redirect the error back to the client
      if (result.redirectUri) {
        const url = new URL(result.redirectUri);
        url.searchParams.set('error', result.error);
        url.searchParams.set('error_description', result.description);
        url.searchParams.set('state', result.state);
        return res.redirect(url.toString());
      }
      // Can't trust redirect_uri — return JSON to the browser
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        error: result.error,
        message: result.description,
      });
    }

    res.cookie('mcdi_auth_req', result.requestId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('app.nodeEnv') === 'production',
      maxAge: 10 * 60 * 1000,
    });

    return res.redirect(`/${this.apiPrefix}/auth/discord`);
  }

  // ─── Start Discord OAuth ──────────────────────────────
  // Reads the auth request from the cookie and redirects to Discord.

  @Get('discord')
  @ApiOperation({
    summary: 'Redirect to Discord OAuth',
    description:
      'Reads the auth request ID from the httpOnly `mcdi_auth_req` cookie ' +
      'set by GET /auth/authorize. Resolves the request, marks it as used, ' +
      'and redirects to Discord OAuth.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Discord OAuth authorization page.',
  })
  async startDiscordAuth(@Req() req: Request, @Res() res: Response) {
    const requestId: string | undefined = (
      req.cookies as Record<string, string>
    )?.mcdi_auth_req;

    if (!requestId) {
      // No cookie — no way to know where to redirect
      const { html } = buildErrorPage(
        'missing_context',
        'Authorization session not found. Please start from the platform login page.',
      );
      return res.status(HttpStatus.BAD_REQUEST).type('html').send(html);
    }

    // Atomic consume: marks as used and returns the row in one query.
    // If two requests race, only one gets the row back.
    const authRequest = await this.authService.consumeAuthRequest(requestId);
    res.clearCookie('mcdi_auth_req');

    if (!authRequest) {
      // Consume failed — look up the original request for redirect info
      const original = await this.authService.findAuthRequestById(requestId);
      if (original) {
        const url = new URL(original.redirectUri);
        url.searchParams.set('error', 'invalid_request');
        url.searchParams.set(
          'error_description',
          'Authorization request has expired or was already used',
        );
        url.searchParams.set('state', original.state);
        return res.redirect(url.toString());
      }
      const { html } = buildErrorPage(
        'invalid_request',
        'Authorization request has expired or was already used. Please try again from the platform login page.',
      );
      return res.status(HttpStatus.BAD_REQUEST).type('html').send(html);
    }

    const result = await this.authService.buildDiscordLoginUrl(
      authRequest.clientId,
      authRequest.serverId,
      authRequest.redirectUri,
      authRequest.state,
    );

    return res.redirect(result.url);
  }

  // ─── Discord callback ───────────────────────────────────
  // Discord redirects here after user authenticates.
  // MCDI processes everything and redirects back to the platform with token + member + roles.

  @Get('discord/callback')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Discord OAuth callback (internal)',
    description:
      'Discord redirects here after user authorization. This endpoint is not called directly by platforms.\n\n' +
      'MCDI processes the callback:\n' +
      '1. Exchanges the Discord code for an access token\n' +
      '2. Fetches user profile & email\n' +
      '3. Upserts member in the database\n' +
      '4. Verifies Discord server membership\n' +
      '5. Checks project role requirements\n' +
      '6. Creates a session token (valid 30 days)\n' +
      "7. Redirects to the platform's redirect_uri with ?token=...&member=...&roles=...\n\n" +
      'On error, redirects with ?error=...&error_description=...',
  })
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.authService.handleDiscordCallback(code, state);
    if ('html' in result) {
      return res.type('html').send(result.html);
    }
    return res.redirect(result.url);
  }

  // ─── Validate session ────────────────────────────────────
  // Platforms call this anytime to verify a token is valid and get current member + roles.
  // Requires a valid X-API-Key — sessions are scoped to the calling project.

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @UseGuards(ThrottlerGuard, ApiKeyGuard)
  @ApiBearerAuth('api-key')
  @ApiOperation({
    summary: 'Validate session token (project-scoped)',
    description:
      'External platforms call this to validate a session token and retrieve ' +
      'current member information + their roles. Roles are fetched live from the DB ' +
      'so they always reflect the latest state.\n\n' +
      'Requires a valid `X-API-Key` header. Only sessions belonging to the calling ' +
      'project are resolved — tokens from other projects are treated as invalid.',
  })
  @ApiBody({ type: ValidateSessionDto })
  @ApiOkResponse({
    description: 'Session valid — member + roles.',
    type: ValidateSessionResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired session token.' })
  @ApiBadRequestResponse({
    description: 'Invalid request body (e.g. empty token).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many validation requests — retry after a short delay.',
  })
  async validateSession(
    @Body() dto: ValidateSessionDto,
    @Req() req: RequestWithProject,
  ) {
    return this.authService.validateSession(dto.token, req.project!.id);
  }

  // ─── Logout ──────────────────────────────────────────────
  // Requires a valid X-API-Key — only sessions belonging to the calling project are deleted.

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth('api-key')
  @ApiOperation({
    summary: 'Invalidate session token (project-scoped)',
    description:
      'External platforms call this when their user logs out to invalidate the MCDI session token.\n\n' +
      'Requires a valid `X-API-Key` header. Only sessions belonging to the calling ' +
      'project are deleted — tokens from other projects are ignored.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({
    description: 'Logout successful.',
    type: SuccessResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body (e.g. empty token).',
  })
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: RequestWithProject,
  ) {
    return this.authService.logout(dto.token, req.project!.id);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth('api-key')
  @ApiOperation({
    summary: 'Invalidate all sessions for a member (project-scoped)',
    description:
      'Invalidates all session tokens for a member within the calling project. ' +
      'Requires a valid `X-API-Key` header. Only sessions belonging to the calling ' +
      'project are affected.',
  })
  @ApiBody({ type: LogoutAllDto })
  @ApiOkResponse({
    description: 'All sessions invalidated.',
    type: SuccessResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body (e.g. empty memberId).',
  })
  async logoutAll(
    @Body() dto: LogoutAllDto,
    @Req() req: RequestWithProject,
  ) {
    return this.authService.logoutAll(dto.memberId, req.project!.id);
  }

  // ─── System Admin Login ─────────────────────────────────────

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(ThrottlerGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({
    summary: 'System admin login (username + password)',
    description:
      'Authenticates a system admin using their Discord username and a pre-set password. ' +
      'The member must exist, have `isSystemAdmin = true`, and have a password configured. ' +
      'Returns a 24-hour Bearer token.' +
      '\n\n**Rate limited:** 5 attempts per 60 seconds per IP.',
  })
  @ApiBody({ type: AdminPasswordLoginDto })
  @ApiOkResponse({
    description: 'Login successful — returns a 24-hour Bearer session token.',
    type: AdminLoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiForbiddenResponse({ description: 'Not a system admin.' })
  @ApiBadRequestResponse({
    description: 'Invalid request body (e.g. empty/short fields).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many login attempts — retry after 60 seconds.',
  })
  async adminPasswordLogin(@Body() dto: AdminPasswordLoginDto) {
    return this.adminAuthService.adminPasswordLogin(dto.username, dto.password);
  }

  // ─── System Admin — Me ────────────────────────────────────────────────

  @Get('admin/me')
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Get current system admin profile',
    description:
      'Returns the profile of the authenticated system admin based on their Bearer session token. ' +
      'Useful for verifying a token is still valid and retrieving up-to-date profile data.',
  })
  @ApiOkResponse({
    description: 'Authenticated admin profile.',
    type: AdminMeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired session token.',
  })
  @ApiForbiddenResponse({
    description: 'Valid session but the member is not a system admin.',
  })
  async adminMe(@Req() req: Request) {
    const token = extractBearerToken(req)!;
    return this.adminAuthService.getMe(token);
  }

  // ─── System Admin — Set Password ─────────────────────────────────────

  @Post('admin/set-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({
    summary: 'Set or change the system admin password',
    description:
      'Sets or updates the password for the authenticated system admin. ' +
      'If a password is already configured, `currentPassword` must be provided and correct. ' +
      'On first-time setup (no password yet), omit `currentPassword`.',
  })
  @ApiBody({ type: SetPasswordDto })
  @ApiOkResponse({
    description: 'Password updated successfully.',
    schema: { example: { message: 'Password updated successfully' } },
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing/invalid session token, or `currentPassword` is incorrect.',
  })
  @ApiForbiddenResponse({
    description: 'Valid session but the member is not a system admin.',
  })
  @ApiBadRequestResponse({
    description:
      '`currentPassword` missing when the account already has a password, or `newPassword` is too short.',
  })
  async adminSetPassword(@Req() req: Request, @Body() dto: SetPasswordDto) {
    const token = extractBearerToken(req)!;
    return this.adminAuthService.setPassword(
      token,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ─── System Admin Discord OAuth2 Login ─────────────────────────

  @Get('admin/discord')
  @ApiOperation({
    summary: 'Initiate system admin Discord OAuth2 login',
    description:
      'Returns a Discord authorization URL. ' +
      'The admin opens the URL, authenticates with Discord, ' +
      'and is redirected to the admin callback endpoint.',
  })
  @ApiOkResponse({
    description: 'Discord authorization URL.',
    schema: {
      example: { url: 'https://discord.com/api/oauth2/authorize?...' },
    },
  })
  async adminDiscordLogin() {
    return this.adminAuthService.buildAdminDiscordLoginUrl();
  }

  @Get('admin/discord/callback')
  @ApiExcludeEndpoint()
  async adminDiscordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.adminAuthService.handleAdminDiscordCallback(
      code,
      state,
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Admin Login — MCDI</title>
  <style>
    body { font-family: monospace; background: #0d1117; color: #c9d1d9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 2rem; max-width: 600px; width: 90%; }
    h1 { color: #58a6ff; font-size: 1.2rem; margin-top: 0; }
    .token { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 0.75rem; word-break: break-all; font-size: 0.85rem; color: #7ee787; }
    p { color: #8b949e; font-size: 0.9rem; }
    .expires { color: #8b949e; font-size: 0.8rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>System Admin Login Successful</h1>
    <p>Welcome, <strong>${result.member.displayName || result.member.username}</strong>. Copy the token below and use it as a Bearer token.</p>
    <div class="token">${result.token}</div>
    <p class="expires">Expires: ${result.expiresAt.toISOString()}</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // ─── Maintenance ─────────────────────────────────────────

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cleanup expired sessions (maintenance)',
    description:
      'Removes expired sessions. Should be called by a scheduled job.',
  })
  @ApiOkResponse({
    description: 'Cleanup completed.',
    type: SuccessResponseDto,
  })
  async cleanupExpired() {
    return this.authService.cleanupExpired();
  }
}
