import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
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

    // 2a. Fast-path: member has isSystemAdmin flag in DB
    const [member] = await this.db
      .select({ isSystemAdmin: schema.members.isSystemAdmin })
      .from(schema.members)
      .where(eq(schema.members.id, memberId))
      .limit(1);

    if (member?.isSystemAdmin) return true;

    // 2b. Fall back: check Lead / Executive Discord role in the main server
    const admin = await isAdminMember(this.db, memberId);
    if (!admin) {
      throw new ForbiddenException(
        'Access restricted to system admins or Lead / Executive members',
      );
    }

    return true;
    */
  }
}
