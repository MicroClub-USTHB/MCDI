import {
  Controller,
  Get,
  Render,
  Query,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiProduces,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  ValidateSessionDto,
  LogoutDto,
  LogoutAllDto,
  ValidateSessionResponseDto,
  SuccessResponseDto,
  ErrorResponseDto,
  AdminPasswordLoginDto,
  AdminLoginResponseDto,
} from './dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Step 1 — Login page
  // Platform redirects user here with: /api/auth/login?api_key=xxx&server_id=yyy&redirect_uri=zzz
  // MCDI validates the API key and renders the login page or an error page.

  @Get('login')
  @Render('login')
  @ApiOperation({
    summary: 'Render login page',
    description:
      'The platform redirects the user here with an API key and optional server ID. ' +
      'MCDI validates the API key against the projects table, resolves the target server ' +
      'and roles, then renders the login page with a "Login with Discord" button. ' +
      'If the API key is invalid, an error page is shown instead.',
  })
  @ApiQuery({
    name: 'api_key',
    required: true,
    description: 'Platform API key',
    example: 'mcdi-internal-events-2024',
  })
  @ApiQuery({
    name: 'server_id',
    required: false,
    description: 'Discord server ID (for external platforms)',
    example: '942073196237642827',
  })
  @ApiQuery({
    name: 'server_name',
    required: false,
    description:
      'Discord server name (alternative to server_id for external platforms)',
    example: 'Main Server',
  })
  @ApiQuery({
    name: 'redirect_uri',
    required: false,
    description:
      'Override callback URI for the platform (defaults to project config)',
  })
  @ApiProduces('text/html')
  @ApiResponse({ status: 200, description: 'Login page rendered (HTML)' })
  async login(
    @Query('api_key') apiKey: string,
    @Query('server_id') serverId: string,
    @Query('server_name') serverName: string,
    @Query('redirect_uri') redirectUri: string,
  ) {
    // If no API key, show error
    if (!apiKey) {
      return {
        error: 'missing_api_key',
        errorDescription: 'No API key provided',
      };
    }

    try {
      // Validate API key and resolve project context
      const context = await this.authService.validateLoginRequest(
        apiKey,
        serverId,
        serverName,
        redirectUri,
      );

      // Pass validated context to the view so the Discord button works
      return {
        apiKey,
        projectName: context.project.name,
        serverId: context.serverId,
        redirectUri: context.redirectUri,
      };
    } catch (err) {
      // Invalid API key or bad config → show error on the page
      return {
        error: 'invalid_request',
        errorDescription:
          (err as Error).message || 'Invalid API key or configuration',
      };
    }
  }

  // ─── Step 2 — Start Discord OAuth
  // User clicks "Login with Discord" → this endpoint builds the Discord URL and redirects.

  @Get('discord')
  @ApiOperation({
    summary: 'Redirect to Discord OAuth',
    description:
      'Called when user clicks "Login with Discord" on the MCDI login page. ' +
      'Builds the Discord OAuth URL with project context encoded in state and redirects the user.',
  })
  @ApiQuery({
    name: 'api_key',
    required: true,
    description: 'Platform API key',
    example: 'mcdi-internal-events-2024',
  })
  @ApiQuery({
    name: 'server_id',
    required: false,
    description: 'Discord server ID',
    example: '942073196237642827',
  })
  @ApiQuery({
    name: 'server_name',
    required: false,
    description: 'Discord server name',
    example: 'Main Server',
  })
  @ApiQuery({
    name: 'redirect_uri',
    required: true,
    description: 'Platform callback URI',
    example: 'http://localhost:4000/auth/callback',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Discord OAuth authorization page',
  })
  async startDiscordAuth(
    @Query('api_key') apiKey: string,
    @Query('server_id') serverId: string,
    @Query('server_name') serverName: string,
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ) {
    // Validate again (in case someone hits this directly)
    const context = await this.authService.validateLoginRequest(
      apiKey,
      serverId,
      serverName,
      redirectUri,
    );

    const result = await this.authService.buildDiscordLoginUrl(
      context.project.id,
      apiKey,
      context.serverId,
      context.redirectUri,
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
  @ApiResponse({
    status: 200,
    description: 'Session valid — member + roles',
    type: ValidateSessionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired session token',
    type: ErrorResponseDto,
  })
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
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
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
  @ApiResponse({
    status: 200,
    description: 'All sessions invalidated',
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
  @ApiResponse({ status: 200, description: 'Login successful', type: AdminLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Not a system admin' })
  async adminPasswordLogin(@Body() dto: AdminPasswordLoginDto) {
    return this.authService.adminPasswordLogin(dto.username, dto.password);
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
  @ApiResponse({ status: 200, description: 'Discord authorization URL', schema: { example: { url: 'https://discord.com/api/oauth2/authorize?...' } } })
  async adminDiscordLogin() {
    return this.authService.buildAdminDiscordLoginUrl();
  }

  @Get('admin/discord/callback')
  @ApiExcludeEndpoint()
  async adminDiscordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.authService.handleAdminDiscordCallback(
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
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed',
    type: SuccessResponseDto,
  })
  async cleanupExpired() {
    return this.authService.cleanupExpired();
  }
}
