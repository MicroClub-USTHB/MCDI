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
import { extractSessionToken, validateSession } from '../utils/auth.util';
import { isAdminMember } from '../utils/admin.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  private readonly executiveRoleId: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    this.executiveRoleId =
      this.configService.get<string>('discord.executiveRoleId') || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // Accept token from Authorization: Bearer <token> OR admin_session httpOnly cookie
    const token = extractSessionToken(request);

    if (!token) {
      throw new UnauthorizedException('Session token is required');
    }

    // 1. Validate session — must exist and not be expired
    const memberId = await validateSession(this.db, token);

    // 2. Sole access criterion: configured admin Discord role ID in the main server
    const isAdmin = await isAdminMember(
      this.db,
      memberId,
      this.executiveRoleId,
    );
    if (!isAdmin) {
      throw new ForbiddenException(
        'Access restricted to members with the configured admin role in the main server',
      );
    }

    return true;
  }
}
