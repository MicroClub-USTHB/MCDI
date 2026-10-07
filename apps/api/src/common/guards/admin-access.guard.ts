import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request } from 'express';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { AdminAccessService } from '../../modules/admin-access/admin-access.service';
import {
  ADMIN_ACCESS_KEY,
  type AdminAccessRequirement,
} from '../decorators/admin-access.decorator';
import { levelAtLeast } from '../permissions/catalog';
import { extractSessionToken, validateSession } from '../utils/auth.util';

/**
 * Gate for every admin endpoint. It fails closed: a handler (or its
 * controller) must declare `@RequirePermission`, `@AdminSessionOnly` or
 * `@RootOnly`, otherwise the request is refused before the session is read.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  private readonly logger = new Logger(AdminAccessGuard.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly reflector: Reflector,
    private readonly adminAccess: AdminAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      AdminAccessRequirement | undefined
    >(ADMIN_ACCESS_KEY, [context.getHandler(), context.getClass()]);

    if (!requirement) {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} has no admin access requirement`,
      );
      throw new ForbiddenException('This endpoint has no declared permission');
    }

    const request = context.switchToHttp().getRequest<Request>();
    // Token from Authorization: Bearer <token> or the admin_session httpOnly cookie
    const token = extractSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Session token is required');
    }

    // Admin login sessions only: project-issued sessions are rejected
    const memberId = await validateSession(this.db, token, { adminOnly: true });
    (request as Request & { memberId: string }).memberId = memberId;

    if (requirement.kind === 'session') return true;

    const { root, access } =
      await this.adminAccess.getEffectiveAccess(memberId);

    if (requirement.kind === 'root') {
      if (!root) throw new ForbiddenException('Restricted to root admins');
      return true;
    }

    const { resource, level } = requirement;
    if (!levelAtLeast(access[resource].level, level)) {
      throw new ForbiddenException(
        `Requires '${level}' access on '${resource}'`,
      );
    }
    return true;
  }
}
