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
import { eq } from 'drizzle-orm';

@Injectable()
export class ServerActiveGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      originalUrl: string;
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: Record<string, string>;
      headers: Record<string, string>;
    }>();
    // this allows admin server-management endpoints to bypass active check
    const url = req.originalUrl ?? '';
    if (/\/servers(?:\/|$)/.test(url)) {
      return true;
    }

    const serverId =
      req.params?.serverId ||
      req.params?.guildId ||
      req.query?.serverId ||
      req.body?.serverId ||
      req.headers['x-server-id'];

    if (!serverId) return true;

    // Skip the active-server check when there is no authentication at all.
    // This allows route-level guards (SystemAdminGuard / ApiKeyGuard) to
    // return 401 before we attempt a DB lookup that would return 403.
    const hasAuth = req.headers.authorization || req.headers['x-api-key'];
    if (!hasAuth) return true;

    const [row] = await this.db
      .select({ isActive: servers.isActive })
      .from(servers)
      .where(eq(servers.id, String(serverId)));

    if (!row?.isActive) {
      throw new ForbiddenException('Server is disabled');
    }

    return true;
  }
}
