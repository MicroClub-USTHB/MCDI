import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';
import { eq, and } from 'drizzle-orm';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { ProjectsService } from '../../modules/projects/projects.service';
import { PROJECT_OPERATION_KEY } from '../decorators/require-project-operation.decorator';
import type { ProjectServerOperation } from '../../modules/projects/projects.repository';
import { verifyApiKey } from '../utils/api-key.util';
import { extractApiKey } from '../utils/auth.util';
import { validateScope } from '../utils/scope.util';
import { SCOPE_KEY } from '../decorators/require-scope.decorator';

type ProjectRow = typeof schema.projects.$inferSelect;

interface RequestWithProject extends Request {
  project?: ProjectRow;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly reflector: Reflector,
    private readonly projectsService: ProjectsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithProject>();
    const apiKey = extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const project = await this.validateApiKey(apiKey);

    if (!project) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Fire-and-forget: update apiKeyLastUsedAt without blocking the request
    Promise.resolve(
      this.db
        .update(schema.projects)
        .set({ apiKeyLastUsedAt: new Date() })
        .where(eq(schema.projects.id, project.id)),
    ).catch((err: unknown) => {
      this.logger.warn(
        `Failed to update apiKeyLastUsedAt for project ${project.id}: ${String(err)}`,
      );
    });

    // Check required scope — needs serverId since scopes are per project-server
    const requiredScope = this.reflector.get<string>(
      SCOPE_KEY,
      context.getHandler(),
    );

    // Checking if project has access to the requested server
    const serverId = this.extractServerId(request);

    // If a scope is required, a serverId must be present (scopes are per-server)
    if (requiredScope) {
      if (!serverId) {
        throw new BadRequestException(
          'Server ID is required when scope validation is needed',
        );
      }
      await validateScope(this.db, project.id, serverId, requiredScope);
    }

    if (!serverId) {
      request.project = project;
      return true;
    }

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

    await this.projectsService.assertProjectAccessOperation(
      project.id,
      serverId,
      requiredOperation,
    );

    request.project = project;

    return true;
  }

  private async validateApiKey(apiKey: string): Promise<ProjectRow | null> {
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

  private extractServerId(request: RequestWithProject): string | null {
    const serverId = request.params['serverId'] ?? request.query['serverId'];
    return typeof serverId === 'string' ? serverId : null;
  }
}
