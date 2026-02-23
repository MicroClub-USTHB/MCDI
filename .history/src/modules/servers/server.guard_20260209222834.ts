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
    const req = context.switchToHttp().getRequest();

    const serverId =
      req.params?.serverId ||
      req.params?.guildId ||
      req.query?.serverId ||
      req.body?.serverId ||
      req.headers['x-server-id'];

    if (!serverId) return true;

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
