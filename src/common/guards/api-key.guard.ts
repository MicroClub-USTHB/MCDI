import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';
import { eq, and } from 'drizzle-orm';
import { Request } from 'express';
import { verifyApiKey } from '../utils/api-key.util';
import { extractApiKey } from '../utils/auth.util';
import { SCOPE_KEY } from '../decorators/require-scope.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const project = await this.validateApiKey(apiKey);

    if (!project) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Fire-and-forget: update apiKeyLastUsedAt without blocking the request
    void this.db
      .update(schema.projects)
      .set({ apiKeyLastUsedAt: new Date() })
      .where(eq(schema.projects.id, project.id));

    // Check required scope if set on the route via @RequireScope()
    const requiredScope = this.reflector.get<string>(SCOPE_KEY, context.getHandler());
    if (requiredScope) {
      await this.validateScope(project.id, requiredScope);
    }

    // Checking if project has access to the requested server
    const serverId = request.params.serverId;
    if (serverId) {
      await this.validateServerAccess(project.id, serverId);
    }

    request.project = project;

    return true;
  }

  private extractApiKey(request: Request): string | null {
    return extractApiKey(request);
  }

  private async validateApiKey(
    apiKey: string,
  ): Promise<typeof schema.projects.$inferSelect | null> {

    const dotIndex = apiKey.indexOf('.');
    if (dotIndex === -1) return null;

    const prefix = apiKey.substring(0, dotIndex);
    const secret = apiKey.substring(dotIndex + 1);

    if (!prefix || !secret) return null;

    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.apiKeyPrefix, prefix),
          eq(schema.projects.isActive, true),
        ),
      )
      .limit(1);

    if (!project || !project.apiKeyHash) {
      return null;
    }

    // Constant-time hash comparison — prevents timing attacks
    const isValid = verifyApiKey(secret, project.apiKeyHash);
    return isValid ? project : null;
  }

  private async validateScope(projectId: string, requiredScope: string): Promise<void> {
    const [scope] = await this.db
      .select()
      .from(schema.projectScopes)
      .where(
        and(
          eq(schema.projectScopes.projectId, projectId),
          eq(schema.projectScopes.scope, requiredScope),
        ),
      )
      .limit(1);

    if (!scope) {
      throw new ForbiddenException(
        `Insufficient scope: '${requiredScope}' is required`,
      );
    }
  }

  private async validateServerAccess(
    projectId: string,
    serverId: string,
  ): Promise<void> {
    // Validating the server ID format
    if (!/^\d{17,20}$/.test(serverId)) {
      throw new BadRequestException('Invalid server ID format');
    }

    // Checking if server exists and is active
    const [server] = await this.db
      .select()
      .from(schema.servers)
      .where(
        and(eq(schema.servers.id, serverId), eq(schema.servers.isActive, true)),
      )
      .limit(1);

    if (!server) {
      throw new ForbiddenException('Server not found or inactive');
    }

    // Checking if project has access to this server
    const [access] = await this.db
      .select()
      .from(schema.projectServers)
      .where(
        and(
          eq(schema.projectServers.projectId, projectId),
          eq(schema.projectServers.serverId, serverId),
        ),
      )
      .limit(1);

    if (!access) {
      throw new ForbiddenException(
        'Project does not have access to this server',
      );
    }

    // Checking if read operation is allowed
    const operations = access.operations as { read?: boolean };
    if (!operations?.read) {
      throw new ForbiddenException(
        'Project does not have read permission for this server',
      );
    }
  }
}
