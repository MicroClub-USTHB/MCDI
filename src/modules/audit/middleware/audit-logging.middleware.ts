import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditRepository, InsertAuditLog } from '../audit.repository';
import { AuditService } from '../audit.service';

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
  // Auth
  [
    /^\/admin\/auth\/login/,
    'POST',
    { actionType: 'auth', action: 'login', entityType: 'session' },
  ],
  [
    /^\/admin\/auth\/logout/,
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
  // Extract UUID or Discord ID from paths like /admin/projects/:id or /admin/servers/:id
  const match = path.match(
    /\/admin\/(?:projects|servers|permissions)\/([^/]+)/,
  );
  return match?.[1] ?? null;
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
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
      const recordUsage = () => {
        this.auditService
          .recordUsage(method, path, res.statusCode, durationMs, projectId)
          .catch(() => {});
      };

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
}
