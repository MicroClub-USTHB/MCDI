import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { DrizzleDB } from '../../database/database.module';
import { DRIZZLE } from '../../database/database.module';
import { servers } from '../../database/entities';
import { inArray } from 'drizzle-orm';

@Injectable()
export class ServerActiveGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      originalUrl: string;
      params?: Record<string, string | string[]>;
      query?: Record<string, string | string[]>;
      body?: Record<string, string | string[]>;
      headers: Record<string, string>;
    }>();
    // this allows admin server-management endpoints to bypass active check
    const url = req.originalUrl ?? '';
    if (/\/servers(?:\/|$)/.test(url)) {
      return true;
    }

    const rawServerId =
      req.params?.serverId ||
      req.params?.guildId ||
      req.query?.serverId ||
      req.body?.serverId ||
      req.headers['x-server-id'];

    if (!rawServerId) return true;

    // Skip the active-server check when there is no authentication at all.
    // This allows route-level guards (SystemAdminGuard / ApiKeyGuard) to
    // return 401 before we attempt a DB lookup that would return 403.
    const hasAuth = req.headers.authorization || req.headers['x-api-key'];
    if (!hasAuth) return true;

    const serverIds = (Array.isArray(rawServerId) ? rawServerId : [rawServerId])
      .flatMap((id) =>
        typeof id === 'string' && id.includes(',') ? id.split(',') : [id],
      )
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean);

    if (serverIds.length === 0) return true;

    const rows = await this.db
      .select({ id: servers.id, isActive: servers.isActive })
      .from(servers)
      .where(inArray(servers.id, serverIds));

    // If any requested server is not found or is disabled, reject
    if (rows.length !== serverIds.length || rows.some((r) => !r.isActive)) {
      throw new ForbiddenException('Server is disabled');
    }

    return true;
  }
}
