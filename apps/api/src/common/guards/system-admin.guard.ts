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
  private readonly adminRoleIds: string[];

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    const executiveRoleId =
      this.configService.get<string>('discord.executiveRoleId') || '';
    const devLeadRoleId =
      this.configService.get<string>('discord.devLeadRoleId') || '';
    const itLeadRoleId =
      this.configService.get<string>('discord.itLeadRoleId') || '';
    this.adminRoleIds = [executiveRoleId, devLeadRoleId, itLeadRoleId].filter(
      Boolean,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // Accept token from Authorization: Bearer <token> OR admin_session httpOnly cookie
    const token = extractSessionToken(request);

    if (!token) {
      throw new UnauthorizedException('Session token is required');
    }

    // Admin login sessions only — project-issued sessions are rejected
    const memberId = await validateSession(this.db, token, {
      adminOnly: true,
    });
    (request as Request & { memberId: string }).memberId = memberId;

    // Access criterion: member holds any of the configured admin Discord role IDs in the main server
    const isAdmin = await isAdminMember(this.db, memberId, this.adminRoleIds);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Access restricted to members with a configured admin role in the main server',
      );
    }

    return true;
  }
}
