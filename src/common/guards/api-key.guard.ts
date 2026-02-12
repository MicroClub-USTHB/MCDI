/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';
import { eq, and } from 'drizzle-orm';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
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

    // Checking if project has access to the requested server
    const serverId = request.params.serverId;
    if (serverId) {
      await this.validateServerAccess(project.id, serverId);
    }

    request.project = project;

    return true;
  }

  private extractApiKey(request: Request): string | null {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const apiKey = request.headers['x-api-key'] || request.query.apiKey;
    return typeof apiKey === 'string' ? apiKey : null;
  }

  private async validateApiKey(
    apiKey: string,
  ): Promise<typeof schema.projects.$inferSelect | null> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.apiKey, apiKey))
      .limit(1);

    return project || null;
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
