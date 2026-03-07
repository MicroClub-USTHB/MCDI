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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
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
  CreateLoginSessionDto,
  LoginSessionResponseDto,
} from './dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @ApiResponse({
    status: 200,
    description: 'Login URL created',
    type: LoginSessionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API key',
    type: ErrorResponseDto,
  })
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
      'MCDI looks up the short-lived token to recover the project context and renders the login page. ' +
      'No API key appears in the URL.',
  })
  @ApiParam({
    name: 'token',
    required: true,
    description: 'Short-lived login token from POST /auth/login-session',
  })
  @ApiProduces('text/html')
  @ApiResponse({ status: 200, description: 'Login page rendered (HTML)' })
  async login(@Param('token') token: string) {
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
          errorDescription: 'Login link has expired or is invalid. Please request a new one from the platform.',
        };
      }

      // Pass validated context to the view so the Discord button works
      return {
        loginToken: token,
        projectName: loginToken.projectId, // Will be enriched if needed
        serverId: loginToken.serverId,
        redirectUri: loginToken.redirectUri,
      };
    } catch (err) {
      return {
        error: 'invalid_request',
        errorDescription:
          (err as Error).message || 'Something went wrong',
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
      'Uses the login_token to recover project context, builds the Discord OAuth URL, and redirects.',
  })
  @ApiQuery({
    name: 'login_token',
    required: true,
    description: 'Short-lived login token',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Discord OAuth authorization page',
  })
  async startDiscordAuth(
    @Query('login_token') loginToken: string,
    @Res() res: Response,
  ) {
    const tokenData = await this.authService.resolveLoginToken(loginToken);

    if (!tokenData) {
      // Render an error page instead of crashing
      return res.render('login', {
        error: 'invalid_token',
        errorDescription: 'Login link has expired or is invalid. Please request a new one from the platform.',
      });
    }

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
