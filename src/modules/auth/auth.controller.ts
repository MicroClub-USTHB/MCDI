import {
  Controller,
  Get,
  Query,
  Post,
  Delete,
  Param,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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
import { SsoService } from './services/sso.service';
import { SessionLifecycleService } from './services/session-lifecycle.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import {
  SessionGuard,
  RequestWithSession,
} from '../../common/guards/session.guard';
import { buildErrorPage } from './utils';
import { extractSessionToken } from '../../common/utils/auth.util';
import { extractClientInfo } from '../../common/utils/client-info.util';
import {
  buildSsoClearCookieOptions,
  buildSsoCookieOptions,
} from '../../common/utils/sso-cookie.util';
import {
  ValidateSessionDto,
  LogoutDto,
  LogoutAllDto,
  ValidateSessionResponseDto,
  SuccessResponseDto,
  AuthorizeQueryDto,
  AdminMeResponseDto,
  ExchangeCodeDto,
  TokenResponseDto,
  SsoSessionStatusDto,
  SsoSessionUnauthenticatedDto,
  SsoProjectSessionListDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  SessionListResponseDto,
} from './dto';

type RequestWithProject = Request & { project?: { id: string } };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly apiPrefix: string;
  private readonly ssoCookieName: string;
  private readonly ssoCookieDomain: string | undefined;
  private readonly ssoTtlSec: number;

  constructor(
    private readonly authService: AuthService,
    private readonly adminAuthService: AdminAuthService,
    private readonly ssoService: SsoService,
    private readonly sessionLifecycleService: SessionLifecycleService,
    private readonly configService: ConfigService,
  ) {
    this.apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    this.ssoCookieName =
      this.configService.get<string>('app.ssoCookieName') || 'mcdi_sso';
    this.ssoCookieDomain = this.configService.get<string | undefined>(
      'app.ssoCookieDomain',
    );
    this.ssoTtlSec = this.configService.get<number>('app.ssoTtlSec')!;
  }

  private get isProduction(): boolean {
    return this.configService.get<string>('app.nodeEnv') === 'production';
  }

  private setSsoCookie(res: Response, token: string): void {
    res.cookie(
      this.ssoCookieName,
      token,
      buildSsoCookieOptions({
        name: this.ssoCookieName,
        domain: this.ssoCookieDomain,
        ttlSec: this.ssoTtlSec,
        isProduction: this.isProduction,
      }),
    );
  }

  private clearSsoCookie(res: Response): void {
    res.clearCookie(
      this.ssoCookieName,
      buildSsoClearCookieOptions({ domain: this.ssoCookieDomain }),
    );
  }

  private readSsoCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[
      this.ssoCookieName
    ];
  }

  // ─── Authorization request ─────────────────────────────
  // Platform redirects user here with query params. MCDI validates, stores
  // the request in DB, sets a cookie, and redirects to Discord OAuth.

  @Get('authorize')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Initiate authorization request (legacy / force re-auth)',
    description:
      'Always bounces through Discord OAuth, even if the browser already ' +
      'holds a valid `mcdi_sso` cookie. Use this when you need fresh ' +
      'Discord consent (step-up auth, admin operations) or to keep a ' +
      'pre-SSO integration unchanged. For the default login button, prefer ' +
      '`GET /auth/sso/authorize` — it skips the Discord screen for ' +
      'returning users.\n\n' +
      'The platform redirects the user here with `client_id`, ' +
      '`redirect_uri`, `server_id`, and `state` as query parameters. MCDI ' +
      'validates the params, creates a short-lived auth request in the DB, ' +
      'sets an httpOnly cookie with the request ID, and redirects to ' +
      'Discord OAuth.',
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
  // MCDI processes everything and redirects back to the platform with a callback code.

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
      '6. Issues a short-lived callback code (120s TTL)\n' +
      "7. Redirects to the platform's redirect_uri with ?code=...&state=...\n\n" +
      'On error, redirects with ?error=...&error_description=...',
  })
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (await this.adminAuthService.hasValidAdminState(state)) {
      const adminFrontendUrl =
        this.configService.get<string>('discord.adminFrontendUrl') || '/admin';
      const isProduction =
        this.configService.get<string>('app.nodeEnv') === 'production';

      try {
        const result = await this.adminAuthService.handleAdminDiscordCallback(
          code,
          state,
          extractClientInfo(req),
        );

        res.cookie('admin_session', result.token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProduction,
          maxAge: 24 * 60 * 60 * 1000,
          path: '/',
        });

        return res.redirect(adminFrontendUrl);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Authentication failed';
        const url = new URL(
          adminFrontendUrl,
          this.configService.get<string>('app.baseUrl'),
        );
        url.searchParams.set('error', message);
        return res.redirect(url.toString());
      }
    }

    const result = await this.authService.handleDiscordCallback(code, state);
    // On a successful member login, mint a global SSO session so subsequent
    // project logins can skip the Discord bounce.
    if ('memberId' in result && result.memberId) {
      const { token } = await this.ssoService.issueSession(result.memberId);
      this.setSsoCookie(res, token);
    }
    return res.redirect(result.url);
  }

  // ─── Exchange callback code ──────────────────────────────
  // Platforms call this to exchange a one-time callback code (from the redirect)
  // for a long-lived session token. Requires a valid X-API-Key.

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(ThrottlerGuard, ApiKeyGuard)
  @ApiBearerAuth('api-key')
  @ApiOperation({
    summary: 'Exchange callback code for session token (backend-to-backend)',
    description:
      'External platforms call this from their backend to exchange the short-lived ' +
      '`code` received in the redirect for a final, long-lived session token.\n\n' +
      'Requires a valid `X-API-Key` header. The code must belong to the project ' +
      'associated with the API key.',
  })
  @ApiBody({ type: ExchangeCodeDto })
  @ApiOkResponse({
    description: 'Exchange successful — returns a long-lived session token.',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired callback code, or project mismatch.',
  })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  @ApiResponse({
    status: 429,
    description: 'Too many exchange requests — retry after a short delay.',
  })
  async exchangeCode(
    @Body() dto: ExchangeCodeDto,
    @Req() req: RequestWithProject,
  ): Promise<TokenResponseDto> {
    if (dto.clientId !== req.project?.id) {
      throw new UnauthorizedException(
        'Client ID mismatch: API Key does not belong to the requested project',
      );
    }

    // Backend-to-backend exchange: this captures the calling platform's
    // transport info (its server IP / HTTP client), not the end user's device,
    // unless the platform forwards the real client via X-Forwarded-For.
    return this.authService.exchangeCodeForToken(
      dto.clientId,
      dto.code,
      dto.redirectUri,
      extractClientInfo(req),
    );
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
  async logout(@Body() dto: LogoutDto, @Req() req: RequestWithProject) {
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
  async logoutAll(@Body() dto: LogoutAllDto, @Req() req: RequestWithProject) {
    return this.authService.logoutAll(dto.memberId, req.project!.id);
  }

  // ─── SSO (global browser session, cookie-based) ──────────────
  //
  // GET  /auth/sso/session    → who is logged in via the mcdi_sso cookie?
  // GET  /auth/sso/authorize  → SSO-aware authorize; skips Discord when valid
  // POST /auth/sso/logout     → destroy SSO + every project session
  // GET  /auth/sso/sessions   → list project sessions under this SSO cookie

  @Get('sso/session')
  @ApiTags('Authentication (SSO)')
  @ApiOperation({
    summary: 'Get current SSO session status',
    description:
      'Reads the `mcdi_sso` httpOnly cookie set after Discord login and ' +
      'returns the authenticated member. Returns 401 with ' +
      '`{ authenticated: false }` when the cookie is missing or expired.',
  })
  @ApiOkResponse({ type: SsoSessionStatusDto })
  @ApiUnauthorizedResponse({ type: SsoSessionUnauthenticatedDto })
  async ssoSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.readSsoCookie(req);
    const resolved = await this.ssoService.resolveSession(token);

    if (!resolved) {
      // Stale or missing cookie — clear it and report unauthenticated.
      if (token) this.clearSsoCookie(res);
      res.status(HttpStatus.UNAUTHORIZED);
      return { authenticated: false };
    }

    return {
      authenticated: true,
      member: {
        id: resolved.member.id,
        discordId: resolved.member.id,
        username: resolved.member.username,
        avatar: resolved.member.avatar,
      },
      expiresAt: resolved.ssoSession.expiresAt,
    };
  }

  @Get('sso/authorize')
  @ApiTags('Authentication (SSO)')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Initiate authorization request (SSO-aware — recommended)',
    description:
      'Recommended default for new "Login with MicroClub" buttons. Same ' +
      'query contract as `GET /auth/authorize`. If the caller has a valid ' +
      '`mcdi_sso` cookie, the Discord OAuth bounce is skipped and the ' +
      "browser is redirected straight to the platform's redirect_uri with " +
      '`?code=...&state=...`. Otherwise this falls back to the existing ' +
      '`/auth/authorize` flow (Discord OAuth).\n\n' +
      'Use `GET /auth/authorize` instead when you need to force a fresh ' +
      'Discord consent.',
  })
  @ApiResponse({
    status: 302,
    description:
      'Redirects either to Discord OAuth (no SSO yet) or back to the ' +
      'platform with a fresh callback code (SSO hit).',
  })
  async ssoAuthorize(
    @Query() dto: AuthorizeQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ssoToken = this.readSsoCookie(req);
    const resolved = await this.ssoService.resolveSession(ssoToken);

    if (resolved) {
      const roleIds = await this.ssoService.getMemberRoleIdsInServer(
        resolved.member.id,
        dto.server_id,
      );

      const result = await this.authService.authorizeWithSso(
        resolved.member.id,
        dto.client_id,
        dto.redirect_uri,
        dto.server_id,
        dto.state,
        roleIds,
      );

      if (result.ok) {
        return res.redirect(result.url);
      }

      // SSO is valid but the project / server / role check failed. Bubble
      // the error back to the platform if we trust the redirect_uri.
      if (result.redirectUri) {
        const url = new URL(result.redirectUri);
        url.searchParams.set('error', result.error);
        url.searchParams.set('error_description', result.description);
        url.searchParams.set('state', result.state);
        return res.redirect(url.toString());
      }
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        error: result.error,
        message: result.description,
      });
    }

    // No SSO yet — clear any stale cookie and fall through to the existing
    // /auth/authorize flow (Discord OAuth bounce). Keeps the SSO endpoint
    // a drop-in replacement.
    if (ssoToken) this.clearSsoCookie(res);
    return this.authorize(dto, res);
  }

  @Post('sso/logout')
  @ApiTags('Authentication (SSO)')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Destroy the global SSO session (log out everywhere)',
    description:
      'Reads the `mcdi_sso` httpOnly cookie, destroys the SSO session, ' +
      'cascades to every project session for the same member, and clears ' +
      'the cookie. Idempotent — succeeds even if the cookie is missing.',
  })
  @ApiNoContentResponse({
    description: 'SSO session destroyed and cookie cleared.',
  })
  async ssoLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = this.readSsoCookie(req);
    if (token) {
      await this.ssoService.logout(token);
    }
    this.clearSsoCookie(res);
  }

  @Get('sso/sessions')
  @ApiTags('Authentication (SSO)')
  @ApiOperation({
    summary: 'List active project sessions under the current SSO session',
    description:
      'Returns one entry per active (non-expired) project session for the ' +
      'member identified by the `mcdi_sso` cookie. Token material is never ' +
      'returned. Returns 401 when the SSO cookie is missing or expired.',
  })
  @ApiOkResponse({ type: SsoProjectSessionListDto })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired SSO cookie.',
  })
  async ssoListSessions(
    @Req() req: Request,
  ): Promise<SsoProjectSessionListDto> {
    const token = this.readSsoCookie(req);
    const resolved = await this.ssoService.resolveSession(token);
    if (!resolved) {
      throw new UnauthorizedException('Invalid or expired SSO session');
    }
    return this.ssoService.listProjectSessions(resolved.member.id);
  }

  // ─── Session lifecycle (member session token) ─────────────
  // Authenticated by the member's own session token (Bearer or admin_session
  // cookie) via SessionGuard, not project-scoped X-API-Key.

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(ThrottlerGuard, SessionGuard)
  @ApiBearerAuth('session-token')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Refresh an active session token',
    description:
      'Rotates an active session. The caller presents the still-valid session ' +
      'token (as a Bearer token) plus its matching refresh token in the body. ' +
      'A new access token and a new refresh token are issued and the expiry is ' +
      'extended — the previous pair is invalidated immediately.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Session refreshed — new access and refresh tokens.',
    type: RefreshTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid/expired session token or refresh token.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request body (e.g. empty refresh token).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many refresh requests - retry after a short delay.',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: RequestWithSession,
  ): Promise<RefreshTokenResponseDto> {
    return this.sessionLifecycleService.refresh(
      req.sessionToken,
      dto.refreshToken,
    );
  }

  @Get('sessions')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @UseGuards(ThrottlerGuard, SessionGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'List active sessions for the current member',
    description:
      "Returns the authenticated member's non-expired sessions, including the " +
      'client metadata captured when each session was created. Token material ' +
      'is never returned.',
  })
  @ApiOkResponse({
    description: 'Active sessions for the current member.',
    type: SessionListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired session token.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - retry after a short delay.',
  })
  async listSessions(
    @Req() req: RequestWithSession,
  ): Promise<SessionListResponseDto> {
    return this.sessionLifecycleService.listActiveSessions(req.memberId);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseGuards(ThrottlerGuard, SessionGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Revoke a specific session',
    description:
      "Immediately revokes one of the current member's sessions. The next " +
      'request using that token will fail. A session that does not exist or ' +
      'belongs to another member is reported as not found.',
  })
  @ApiNoContentResponse({ description: 'Session revoked.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired session token.',
  })
  @ApiNotFoundResponse({
    description: 'Session not found for the current member.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - retry after a short delay.',
  })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: RequestWithSession,
  ): Promise<void> {
    await this.sessionLifecycleService.revokeSession(req.memberId, sessionId);
  }

  // ─── System Admin Login (Discord OAuth2 only) ──────────────
  //
  // GET  /auth/admin/discord          → initiate Discord OAuth
  // GET  /auth/admin/discord/callback → handle Discord callback,
  //                                     set httpOnly cookie, redirect to frontend
  // GET  /auth/admin/me               → return current admin profile

  // ─── System Admin — Me ────────────────────────────────────────────────

  @Get('admin/me')
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Get current system admin profile',
    description:
      'Returns the profile of the authenticated system admin based on their Bearer session token ' +
      'or the `admin_session` httpOnly cookie set after Discord OAuth2 login. ' +
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
    description:
      'Valid session but the member lacks the configured admin role.',
  })
  async adminMe(@Req() req: Request) {
    const token = extractSessionToken(req)!;
    return this.adminAuthService.getMe(token);
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Log out of the admin dashboard',
    description:
      'Invalidates the current admin session and clears the `admin_session` ' +
      'httpOnly cookie. Accepts the token via Authorization: Bearer or the ' +
      '`admin_session` cookie, same as other admin routes.',
  })
  @ApiOkResponse({
    description: 'Logout successful.',
    type: SuccessResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired session token.',
  })
  async adminLogout(@Req() req: Request, @Res() res: Response) {
    const token = extractSessionToken(req)!;
    await this.authService.adminLogout(token);

    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';
    res.clearCookie('admin_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
    });
    res.json({ success: true });
  }

  // ─── POST /auth/admin/set-password has been removed.
  // Admin access is gated solely on the configured Discord admin role ID.

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
  async adminDiscordLogin(@Req() req: Request, @Res() res: Response) {
    const result = await this.adminAuthService.buildAdminDiscordLoginUrl();
    const accept = req.headers.accept || '';

    if (accept.includes('text/html')) {
      return res.redirect(result.url);
    }

    return res.json(result);
  }

  @Get('admin/discord/callback')
  @ApiExcludeEndpoint()
  async adminDiscordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const adminFrontendUrl =
      this.configService.get<string>('discord.adminFrontendUrl') || '/admin';
    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';

    try {
      const result = await this.adminAuthService.handleAdminDiscordCallback(
        code,
        state,
        extractClientInfo(req),
      );

      // Set an httpOnly session cookie so the admin frontend does not need to
      // store the token in JS-accessible storage.
      res.cookie('admin_session', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });

      return res.redirect(adminFrontendUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      const url = new URL(
        adminFrontendUrl,
        this.configService.get<string>('app.baseUrl'),
      );
      url.searchParams.set('error', message);
      return res.redirect(url.toString());
    }
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
