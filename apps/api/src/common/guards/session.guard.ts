import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request } from 'express';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { extractSessionToken, validateSession } from '../utils/auth.util';

export type RequestWithSession = Request & {
  memberId: string;
  sessionToken: string;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractSessionToken(request);

    if (!token) {
      throw new UnauthorizedException('Session token is required');
    }

    const memberId = await validateSession(this.db, token);
    const req = request as RequestWithSession;
    req.memberId = memberId;
    req.sessionToken = token;

    return true;
  }
}
