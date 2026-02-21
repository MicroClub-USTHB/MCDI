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
import { Reflector } from '@nestjs/core';
import { ProjectsAccessService } from '../../modules/projects/projects-access.service';
import { PROJECT_OPERATION_KEY } from '../decorators/require-project-operation.decorator';
import type { ProjectServerOperation } from '../../modules/projects/projects-access.types';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly reflector: Reflector,
    private readonly projectsAccessService: ProjectsAccessService,
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
    const serverId = this.extractServerId(request);
    if (!serverId) return true;

    if (!/^\d{17,20}$/.test(serverId)) {
      throw new BadRequestException('Invalid server ID format');
    }

    const [server] = await this.db
      .select({ id: schema.servers.id })
      .from(schema.servers)
      .where(
        and(eq(schema.servers.id, serverId), eq(schema.servers.isActive, true)),
      )
      .limit(1);

    if (!server) {
      throw new ForbiddenException('Server not found or inactive');
    }

    const requiredOperation =
      this.reflector.getAllAndOverride<ProjectServerOperation>(
        PROJECT_OPERATION_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'READ';

    await this.projectsAccessService.assertProjectAccessOperation(
      project.id,
      serverId,
      requiredOperation,
    );

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

  private extractServerId(request: Request): string | null {
    const serverId = request.params.serverId || request.query.serverId;
    return typeof serverId === 'string' ? serverId : null;
  }

}
