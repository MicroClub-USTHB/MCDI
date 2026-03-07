import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request } from 'express';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { extractBearerToken, validateSession } from '../utils/auth.util';
import { isAdminMember } from '../utils/admin.util';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // TODO: Remove this bypass after testing — re-enable auth check
    return true;

    /*
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Session token is required');
    }

    // 1. Validate session — must exist and not be expired
    const memberId = await validateSession(this.db, token);

    // 2. Check member has Lead+ role in the main server
    const admin = await isAdminMember(this.db, memberId);
    if (!admin) {
      throw new ForbiddenException(
        'Access restricted to Lead or Executive members',
      );
    }

    return true;
    */
  }
}
