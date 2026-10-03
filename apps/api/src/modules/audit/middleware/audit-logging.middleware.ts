import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ADMIN_SESSION_COOKIE } from '@mcdi/contracts';
import { Request, Response, NextFunction } from 'express';
import { AuditRepository, InsertAuditLog } from '../audit.repository';
import { AuditService } from '../audit.service';
import { extractBearerToken } from '../../../common/utils/auth.util';

type AuditActionType = InsertAuditLog['actionType'];

// Set by ApiKeyGuard once a project API key has been verified.
interface RequestWithProject extends Request {
  project?: { id: string };
}

// Maps HTTP method + route pattern to audit action type and action name
interface RouteAction {
  actionType: AuditActionType;
  action: string;
  entityType: string;
}

const ROUTE_MAP: [RegExp, string, RouteAction][] = [
  // Auth (admin login rows are written by AdminAuthService because the
  // OAuth callback answers with a redirect whatever the outcome)
  [
    /^\/auth\/admin\/logout$/,
    'POST',
    { actionType: 'auth', action: 'logout', entityType: 'session' },
  ],

  // Projects
  [
    /^\/admin\/projects$/,
    'POST',
    { actionType: 'project', action: 'created', entityType: 'project' },
  ],
  [
    /^\/admin\/projects\/[^/]+$/,
    'PATCH',
    { actionType: 'project', action: 'updated', entityType: 'project' },
  ],
  [
    /^\/admin\/projects\/[^/]+$/,
    'DELETE',
    { actionType: 'project', action: 'deleted', entityType: 'project' },
  ],
  [
    /^\/admin\/projects\/[^/]+\/regenerate-api-key/,
    'POST',
    { actionType: 'project', action: 'key_regenerated', entityType: 'project' },
  ],
  [
    /^\/admin\/projects\/[^/]+\/key/,
    'DELETE',
    { actionType: 'project', action: 'key_revoked', entityType: 'project' },
  ],
  [
    /^\/admin\/projects\/[^/]+\/restore-key/,
    'POST',
    { actionType: 'project', action: 'key_generated', entityType: 'project' },
  ],

  // Servers
  [
    /^\/admin\/servers$/,
    'POST',
    { actionType: 'server', action: 'registered', entityType: 'server' },
  ],
  [
    /^\/admin\/servers\/[^/]+$/,
    'PATCH',
    { actionType: 'server', action: 'updated', entityType: 'server' },
  ],
  [
    /^\/admin\/servers\/[^/]+$/,
    'DELETE',
    { actionType: 'server', action: 'deleted', entityType: 'server' },
  ],
  [
    /^\/admin\/servers\/[^/]+\/enable/,
    'POST',
    { actionType: 'server', action: 'enabled', entityType: 'server' },
  ],
  [
    /^\/admin\/servers\/[^/]+\/disable/,
    'POST',
    { actionType: 'server', action: 'disabled', entityType: 'server' },
  ],

  // Sync
  [
    /^\/admin\/sync/,
    'POST',
    { actionType: 'sync', action: 'triggered', entityType: 'sync' },
  ],

  // Members
  [
    /^\/admin\/members\/export/,
    'GET',
    { actionType: 'member', action: 'exported', entityType: 'member' },
  ],

  // Permissions / Roles
  [
    /^\/admin\/permissions/,
    'POST',
    {
      actionType: 'permission',
      action: 'permission_added',
      entityType: 'permission',
    },
  ],
  [
    /^\/admin\/permissions/,
    'DELETE',
    {
      actionType: 'permission',
      action: 'permission_removed',
      entityType: 'permission',
    },
  ],

  // Webhooks
  [
    /^\/servers\/[^/]+\/channels\/[^/]+\/webhooks\/?$/,
    'POST',
    { actionType: 'webhook', action: 'created', entityType: 'webhook' },
  ],
  [
    /^\/webhooks\/[^/]+\/?$/,
    'PATCH',
    { actionType: 'webhook', action: 'updated', entityType: 'webhook' },
  ],
  [
    /^\/webhooks\/[^/]+\/?$/,
    'DELETE',
    { actionType: 'webhook', action: 'deleted', entityType: 'webhook' },
  ],
  [
    /^\/webhooks\/[^/]+\/execute\/?$/,
    'POST',
    { actionType: 'webhook', action: 'executed', entityType: 'webhook' },
  ],
  [
    /^\/admin\/webhooks\/[^/]+\/?$/,
    'DELETE',
    { actionType: 'webhook', action: 'deleted', entityType: 'webhook' },
  ],
];

function resolveRouteAction(path: string, method: string): RouteAction | null {
  for (const [pattern, httpMethod, routeAction] of ROUTE_MAP) {
    if (method === httpMethod && pattern.test(path)) {
      return routeAction;
    }
  }
  return null;
}

function extractEntityId(path: string): string | null {
  const webhookMatch = path.match(/^\/webhooks\/([^/]+)/);
  if (webhookMatch) return webhookMatch[1];

  const adminMatch = path.match(
    /\/admin\/(?:projects|servers|permissions|webhooks)\/([^/]+)/,
  );
  return adminMatch?.[1] ?? null;
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? 'unknown');
  // audit_logs.ip_address is varchar(45), so anything longer fails the insert.
  return ip.length > 45 ? 'unknown' : ip;
}

// ApiKeyGuard also accepts the key as a Bearer token. A dotted bearer value is
// an API key, since session tokens are hex and never carry a dot.
function extractPresentedApiKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header) return header;
  const query = req.query.apiKey;
  if (typeof query === 'string' && query) return query;
  const bearer = extractBearerToken(req);
  return bearer?.includes('.') ? bearer : null;
}

function extractPresentedSessionToken(req: Request): string | null {
  const bearer = extractBearerToken(req);
  if (bearer && !bearer.includes('.')) return bearer;
  return (
    (req.cookies as Record<string, string> | undefined)?.[
      ADMIN_SESSION_COOKIE
    ] ?? null
  );
}

// Keys are "<prefix>.<secret>"; only the prefix may be stored, and 64
// characters bound what a caller can push into the row.
function apiKeyPrefix(apiKey: string): string | null {
  const dot = apiKey.indexOf('.');
  return dot > 0 ? apiKey.slice(0, dot).slice(0, 64) : null;
}

@Injectable()
export class AuditLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLoggingMiddleware.name);
  // Nest binds a wildcard middleware once per route excluded from the global
  // prefix, so a single request can enter use() more than once.
  private readonly seen = new WeakSet<Request>();

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly auditService: AuditService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.seen.has(req)) {
      next();
      return;
    }
    this.seen.add(req);

    const startTime = Date.now();

    res.on('finish', () => {
      // Skip GET requests for audit logs (read-only, no state change)
      // except member exports which are auditable
      const path = req.originalUrl.replace(/\?.*$/, '').replace(/^\/api/, '');
      const method = req.method;
      const durationMs = Date.now() - startTime;
      const projectId = (req as RequestWithProject).project?.id;
      // Express sets req.route only once a handler matched, so a 404 without
      // one is Nest's fallback for an unknown path. Those share a single key
      // so scanner traffic cannot grow the per-endpoint hashes.
      const usagePath =
        res.statusCode === 404 && req.route === undefined
          ? '/<unmatched>'
          : path;
      const recordUsage = () => {
        this.auditService
          .recordUsage(method, usagePath, res.statusCode, durationMs, projectId)
          .catch(() => {});
      };

      // Runs before the GET skip because most rejected credentials arrive
      // on reads.
      if (res.statusCode === 401 || res.statusCode === 403) {
        this.recordAuthFailure(req, res, method, path);
      }

      if (method === 'GET' && !path.includes('/export')) {
        // Still record usage for GET requests
        recordUsage();
        return;
      }

      // Only audit successful mutations (2xx/3xx)
      if (res.statusCode >= 400) {
        recordUsage();
        return;
      }

      const routeAction = resolveRouteAction(path, method);
      if (!routeAction) {
        recordUsage();
        return;
      }

      const memberId = (req as Request & { memberId?: string }).memberId;

      const entry: InsertAuditLog = {
        actorId: memberId ?? null,
        actorName: null,
        actionType: routeAction.actionType,
        action: routeAction.action,
        entityType: routeAction.entityType,
        entityId: extractEntityId(path),
        details: {
          method,
          path,
          statusCode: res.statusCode,
          durationMs,
        },
        ipAddress: extractIp(req),
        userAgent: req.headers['user-agent'] ?? null,
        severity: 'info',
      };

      this.auditRepository.insert(entry).catch((err: Error) => {
        this.logger.warn(`Failed to write audit log: ${err.message}`);
      });

      recordUsage();
    });

    next();
  }

  // Only the credential the guards actually turned away is recorded.
  // req.project and req.memberId are the acceptance signals the guards leave
  // behind, so a credential paired with a missing signal is the failed one. A
  // hit carrying no credential writes no row, while a presented credential is
  // recorded by design. The reason is stashed on res.locals by the exception
  // filters, which are the only code that sees the thrown message.
  private recordAuthFailure(
    req: Request,
    res: Response,
    method: string,
    path: string,
  ): void {
    const apiKey = extractPresentedApiKey(req);
    const sessionToken = extractPresentedSessionToken(req);
    const memberId = (req as Request & { memberId?: string }).memberId;
    const projectAccepted = Boolean((req as RequestWithProject).project);

    let action: 'api_key_rejected' | 'session_rejected' | null = null;
    if (res.statusCode === 401) {
      if (apiKey && !projectAccepted) {
        action = 'api_key_rejected';
      } else if (sessionToken && !memberId) {
        action = 'session_rejected';
      }
    } else if (res.statusCode === 403 && sessionToken && memberId) {
      // A valid session that lacks the admin role. Other 403s are not a
      // verdict on the presented credential.
      action = 'session_rejected';
    }
    if (!action) return;

    const reason = (res.locals as { authFailureReason?: string })
      .authFailureReason;

    const entry: InsertAuditLog = {
      actorId: memberId ?? null,
      actorName: null,
      actionType: 'auth',
      action,
      entityType: 'session',
      entityId: null,
      details: {
        reason: reason ?? null,
        method,
        path,
        attemptedActor:
          action === 'api_key_rejected' && apiKey ? apiKeyPrefix(apiKey) : null,
      },
      ipAddress: extractIp(req),
      userAgent: req.headers['user-agent'] ?? null,
      severity: 'warning',
    };

    this.auditRepository.insert(entry).catch((err: Error) => {
      this.logger.warn(`Failed to write auth failure log: ${err.message}`);
    });
  }
}
