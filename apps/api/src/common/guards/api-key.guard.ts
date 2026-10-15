import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';
import { eq, and } from 'drizzle-orm';
import { Request } from 'express';
import { Reflector, ModuleRef } from '@nestjs/core';
import { ProjectsService } from '../../modules/projects/projects.service';
import { ProjectAuthCacheService } from '../../modules/projects/project-auth-cache.service';
import { PROJECT_OPERATION_KEY } from '../decorators/require-project-operation.decorator';
import type { ProjectServerOperation } from '../../modules/projects/projects.repository';
import { verifyApiKey } from '../utils/api-key.util';
import { extractApiKey } from '../utils/auth.util';
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
    private readonly moduleRef: ModuleRef,
  ) {}

  private get projectsService(): ProjectsService {
    return this.moduleRef.get(ProjectsService, { strict: false });
  }

  private get projectAuthCache(): ProjectAuthCacheService {
    return this.moduleRef.get(ProjectAuthCacheService, { strict: false });
  }

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

    await this.touchApiKeyLastUsed(project.id);

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
    }

    if (!serverId) {
      request.project = project;
      return true;
    }

    if (!/^\d{17,20}$/.test(serverId)) {
      throw new BadRequestException('Invalid server ID format');
    }

    const requiredOperation =
      this.reflector.getAllAndOverride<ProjectServerOperation>(
        PROJECT_OPERATION_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'READ';

    await this.projectsService.assertProjectServerRequestAccess({
      projectId: project.id,
      serverId,
      operation: requiredOperation,
      requiredScope: requiredScope ?? undefined,
    });

    request.project = project;

    return true;
  }

  private async validateApiKey(apiKey: string): Promise<ProjectRow | null> {
    const cachedProject = await this.projectAuthCache.get(apiKey);
    if (cachedProject) {
      return cachedProject;
    }

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
    if (!isValid) {
      return null;
    }

    await this.projectAuthCache.set(apiKey, project);
    return project;
  }

  private async touchApiKeyLastUsed(projectId: string): Promise<void> {
    const shouldRefresh =
      await this.projectAuthCache.shouldRefreshLastUsed(projectId);

    if (!shouldRefresh) {
      return;
    }

    Promise.resolve(
      this.db
        .update(schema.projects)
        .set({ apiKeyLastUsedAt: new Date() })
        .where(eq(schema.projects.id, projectId)),
    ).catch((err: unknown) => {
      this.logger.warn(
        `Failed to update apiKeyLastUsedAt for project ${projectId}: ${String(err)}`,
      );
    });
  }

  private extractServerId(request: RequestWithProject): string | null {
    const body = request.body as { serverId?: unknown } | undefined;
    const serverId =
      request.params['serverId'] ?? request.query['serverId'] ?? body?.serverId;
    return typeof serverId === 'string' ? serverId : null;
  }
}
