import {
  Controller,
  Get,
  Render,
  Query,
  Param,
  Post,
  Body,
  Res,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiBody,
  ApiProduces,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import {
  ValidateSessionDto,
  LogoutDto,
  LogoutAllDto,
  ValidateSessionResponseDto,
  SuccessResponseDto,
  CreateLoginSessionDto,
  LoginSessionResponseDto,
  AdminPasswordLoginDto,
  AdminLoginResponseDto,
} from './dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  // ─── Step 0 — Create login session (server-to-server)
  // Platform calls this with API key in header to get a short-lived login URL.
  // The user's browser never sees the API key.

  @Post('login-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a login session (server-to-server)',
    description:
      'Platforms call this endpoint server-to-server with their API key in the X-API-Key header. ' +
      'Returns a short-lived login URL that the platform redirects the user to. ' +
      'This keeps the API key out of browser URLs, logs, and history.',
  })
  @ApiBody({ type: CreateLoginSessionDto })
  @ApiOkResponse({
    description: 'Login URL created.',
    type: LoginSessionResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid API key.' })
  async createLoginSession(
    @Headers('x-api-key') apiKey: string,
    @Body() dto: CreateLoginSessionDto,
  ) {
    if (!apiKey) {
      return {
        error: 'missing_api_key',
        errorDescription: 'X-API-Key header is required',
      };
    }

    return this.authService.createLoginSession(
      apiKey,
      dto.serverId,
      dto.serverName,
      dto.redirectUri,
    );
  }

  // ─── Step 1 — Login page (token-based)
  // Platform redirects user here with: /api/auth/login/<token>
  // MCDI looks up the login token which already contains the validated project context.

  @Get('login/:token')
  @Render('login')
  @ApiOperation({
    summary: 'Render login page (token-based)',
    description:
      'The platform redirects the user here using the loginUrl returned by POST /auth/login-session. ' +
      'MCDI looks up the short-lived token to recover the project context, sets an httpOnly session ' +
      'cookie so the token never reappears in a URL, then renders the login page.',
  })
  @ApiParam({
    name: 'token',
    required: true,
    description: 'Short-lived login token from POST /auth/login-session',
  })
  @ApiProduces('text/html')
  @ApiOkResponse({ description: 'Login page rendered (HTML).' })
  async login(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      return {
        error: 'missing_token',
        errorDescription: 'No login token provided',
      };
    }

    try {
      const loginToken = await this.authService.resolveLoginToken(token);

      if (!loginToken) {
        return {
          error: 'invalid_token',
          errorDescription:
            'Login link has expired or is invalid. Please request a new one from the platform.',
        };
      }

      // Store the login token in an httpOnly cookie (5-min TTL matches the token)
      // so it never needs to appear in a URL again.
      res.cookie('mcdi_login_ctx', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
      });

      return {
        projectName: loginToken.projectName,
        serverId: loginToken.serverId,
        redirectUri: loginToken.redirectUri,
      };
    } catch (err) {
      return {
        error: 'invalid_request',
        errorDescription: (err as Error).message || 'Something went wrong',
      };
    }
  }

  // ─── Step 2 — Start Discord OAuth
  // User clicks "Login with Discord" → this endpoint looks up the login token and redirects.

  @Get('discord')
  @ApiOperation({
    summary: 'Redirect to Discord OAuth',
    description:
      'Called when user clicks "Login with Discord" on the MCDI login page. ' +
      'Reads the login context from the httpOnly `mcdi_login_ctx` cookie set during the ' +
      'login page render — no token ever appears in the URL.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Discord OAuth authorization page',
  })
  async startDiscordAuth(@Req() req: Request, @Res() res: Response) {
    const loginTokenValue: string | undefined = (
      req.cookies as Record<string, string>
    )?.mcdi_login_ctx;

    if (!loginTokenValue) {
      return res.render('login', {
        error: 'missing_context',
        errorDescription:
          'Login session not found. Please use the login link provided by the platform.',
      });
    }

    const tokenData = await this.authService.resolveLoginToken(loginTokenValue);

    if (!tokenData) {
      return res.render('login', {
        error: 'invalid_token',
        errorDescription:
          'Login link has expired or is invalid. Please request a new one from the platform.',
      });
    }

    // Clear the cookie — it is single-use from this point forward
    res.clearCookie('mcdi_login_ctx');

    const result = await this.authService.buildDiscordLoginUrl(
      tokenData.projectId,
      tokenData.serverId,
      tokenData.redirectUri,
    );

    return res.redirect(result.url);
  }

  // ─── Step 3 — Discord callback ───────────────────────────
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

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate session token',
    description:
      'External platforms call this to validate a session token and retrieve ' +
      'current member information + their roles. Roles are fetched live from the DB ' +
      'so they always reflect the latest state.',
  })
  @ApiBody({ type: ValidateSessionDto })
  @ApiOkResponse({
    description: 'Session valid — member + roles.',
    type: ValidateSessionResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired session token.' })
  async validateSession(@Body() dto: ValidateSessionDto) {
    return this.authService.validateSession(dto.token);
  }

  // ─── Logout ──────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate session token',
    description:
      'External platforms call this when their user logs out to invalidate the MCDI session token.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({
    description: 'Logout successful.',
    type: SuccessResponseDto,
  })
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.token);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate all sessions for a member',
    description:
      'Invalidates all session tokens for a member across all platforms. ' +
      'Typically called by MCDI admin operations.',
  })
  @ApiBody({ type: LogoutAllDto })
  @ApiOkResponse({
    description: 'All sessions invalidated.',
    type: SuccessResponseDto,
  })
  async logoutAll(@Body() dto: LogoutAllDto) {
    return this.authService.logoutAll(dto.memberId);
  }

  // ─── System Admin Login ─────────────────────────────────────

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({
    summary: 'System admin login (username + password)',
    description:
      'Authenticates a system admin using their Discord username and a pre-set password. ' +
      'The member must exist, have `isSystemAdmin = true`, and have a password configured. ' +
      'Returns a 24-hour Bearer token.',
  })
  @ApiBody({ type: AdminPasswordLoginDto })
  @ApiOkResponse({
    description: 'Login successful.',
    type: AdminLoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiForbiddenResponse({ description: 'Not a system admin.' })
  async adminPasswordLogin(@Body() dto: AdminPasswordLoginDto) {
    return this.adminAuthService.adminPasswordLogin(dto.username, dto.password);
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
