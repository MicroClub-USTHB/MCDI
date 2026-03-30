import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProjectServerOperations } from '../../database/entities/project-server.entity';
import { generateApiKey } from '../../common/utils/api-key.util';
import { CreateProjectDto, ProjectScope } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateRedirectUriDto } from './dto/update-redirect-uri.dto';
import {
  DEFAULT_PROJECT_SERVER_OPERATIONS,
  ProjectServerOperation,
  ProjectServerAccessState,
  ProjectsRepository,
  ProjectRow,
  ListProjectsFilters,
  ListServersByProjectFilters,
  ListProjectsByServerFilters,
  ListAccessMatrixFilters,
  ListAuditFilters,
} from './projects.repository';
import { ProjectAuthCacheService } from './project-auth-cache.service';
import { ProjectAccessCacheService } from './project-access-cache.service';

export interface CreateProjectResult {
  /** Returned ONCE — never stored in plaintext, never returned again */
  apiKey: string;
  project: ProjectRow;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly projectAuthCache: ProjectAuthCacheService,
    private readonly projectAccessCache: ProjectAccessCacheService,
  ) {}

  async create(dto: CreateProjectDto): Promise<CreateProjectResult> {
    let serverAccessConfig = dto.serverAccess ?? [];

    if (serverAccessConfig.length === 0) {
      const mainServers = await this.projectsRepository.findMainServers();
      if (mainServers.length === 0) {
        throw new ConflictException(
          'No active main server is configured. Provide explicit serverAccess or configure a main server first',
        );
      }

      serverAccessConfig = mainServers.map((s) => ({
        serverId: s.id,
        scopes: Object.values(ProjectScope),
      }));
    }

    const invalidServerIds: string[] = [];
    for (const access of serverAccessConfig) {
      const server = await this.projectsRepository.findServerById(
        access.serverId,
      );
      if (!server) {
        invalidServerIds.push(access.serverId);
      }
    }

    if (invalidServerIds.length > 0) {
      throw new BadRequestException(
        `Unknown server IDs in serverAccess: ${Array.from(new Set(invalidServerIds)).join(', ')}`,
      );
    }

    const { fullKey, prefix, hash } = generateApiKey();

    const project = await this.projectsRepository.create({
      name: dto.name,
      description: dto.description,
      isInternal: dto.isInternal ?? false,
      webhookUrl: dto.webhookUrl,
      isActive: dto.isActive ?? true,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
    });

    const now = new Date();
    for (const access of serverAccessConfig) {
      const scopes = access.scopes ?? Object.values(ProjectScope);

      await this.projectsRepository.upsertAccessMapping(
        project.id,
        access.serverId,
        DEFAULT_PROJECT_SERVER_OPERATIONS,
        now,
        scopes,
      );
      await this.projectsRepository.insertAuditEntry({
        projectId: project.id,
        serverId: access.serverId,
        action: 'GRANT',
        operationsBefore: null,
        operationsAfter: DEFAULT_PROJECT_SERVER_OPERATIONS,
        changedBy: 'system:project-creation',
        changedAt: now,
      });
    }

    return { apiKey: fullKey, project };
  }

  async findAll(filters?: ListProjectsFilters): Promise<ProjectRow[]> {
    return this.projectsRepository.findAll(filters);
  }

  async findOne(id: string): Promise<ProjectRow> {
    const project = await this.projectsRepository.findOne(id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async getApiKeyInfo(id: string) {
    const project = await this.findOne(id);
    return {
      projectId: project.id,
      projectName: project.name,
      apiKeyPrefix: project.apiKeyPrefix,
      apiKeyCreatedAt: project.apiKeyCreatedAt,
      apiKeyLastUsedAt: project.apiKeyLastUsedAt,
      isActive: project.isActive,
    };
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectRow> {
    const project = await this.projectsRepository.update(id, {
      name: dto.name,
      description: dto.description,
      isInternal: dto.isInternal,
      isActive: dto.isActive,
      webhookUrl: dto.webhookUrl,
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);

    await this.invalidateProjectCaches(project.id);
    return project;
  }

  async revokeKey(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.projectsRepository.setActive(id, false);
    await this.invalidateProjectCaches(id);
  }

  async restoreKey(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.projectsRepository.setActive(id, true);
    await this.invalidateProjectCaches(id);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.projectsRepository.delete(id);
    if (!deleted) throw new NotFoundException(`Project ${id} not found`);
    await this.invalidateProjectCaches(id);
  }

  // ── Admin-only operations ─────────────────────────────────────────────

  /**
   * Regenerate API key (admin). Returns the full key once — never retrievable again.
   */
  async regenerateApiKeyAdmin(id: string) {
    const { fullKey, prefix, hash } = generateApiKey();
    const project = await this.projectsRepository.regenerateApiKey(
      id,
      hash,
      prefix,
    );
    if (!project)
      throw new NotFoundException(`Project with ID ${id} not found`);
    await this.invalidateProjectCaches(project.id);
    return {
      projectId: project.id,
      apiKey: fullKey,
      apiKeyPrefix: project.apiKeyPrefix,
      apiKeyCreatedAt: project.apiKeyCreatedAt,
    };
  }

  /**
   * Update the allowed redirect URI(s) for a project (admin).
   */
  async updateRedirectUri(id: string, dto: UpdateRedirectUriDto) {
    const project = await this.projectsRepository.updateRedirectUri(
      id,
      dto.redirectUri,
    );
    if (!project)
      throw new NotFoundException(`Project with ID ${id} not found`);
    return { projectId: project.id, redirectUri: project.redirectUri };
  }

  // ─── Project-Server Access ────────────────────────────────────────────

  private normalizeOperations(
    operations?: Partial<ProjectServerOperations>,
  ): ProjectServerOperations {
    return {
      READ: operations?.READ ?? DEFAULT_PROJECT_SERVER_OPERATIONS.READ,
      SEND_MESSAGES:
        operations?.SEND_MESSAGES ??
        DEFAULT_PROJECT_SERVER_OPERATIONS.SEND_MESSAGES,
      MANAGE_WEBHOOKS:
        operations?.MANAGE_WEBHOOKS ??
        DEFAULT_PROJECT_SERVER_OPERATIONS.MANAGE_WEBHOOKS,
    };
  }

  async grantAccess(params: {
    projectId: string;
    serverId: string;
    operations?: Partial<ProjectServerOperations>;
    scopes?: string[];
    changedBy: string;
  }) {
    const project = await this.projectsRepository.findProjectById(
      params.projectId,
    );
    if (!project) throw new NotFoundException('Project not found');

    const server = await this.projectsRepository.findServerById(
      params.serverId,
    );
    if (!server) throw new NotFoundException('Server not found');

    const before = await this.projectsRepository.findAccessMapping(
      params.projectId,
      params.serverId,
    );
    const now = new Date();
    const normalizedOps = this.normalizeOperations(params.operations);

    // If scopes are provided, use them; otherwise keep existing or default to all
    const scopes =
      params.scopes ??
      (before?.scopes as string[] | undefined) ??
      Object.values(ProjectScope);

    const saved = await this.projectsRepository.upsertAccessMapping(
      params.projectId,
      params.serverId,
      normalizedOps,
      now,
      scopes,
    );

    await this.projectsRepository.insertAuditEntry({
      projectId: params.projectId,
      serverId: params.serverId,
      action: before ? 'UPDATE' : 'GRANT',
      operationsBefore: before?.operations ?? null,
      operationsAfter: normalizedOps,
      changedBy: params.changedBy,
      changedAt: now,
    });

    await this.invalidateProjectServerAccess(params.projectId, params.serverId);

    return saved;
  }

  async revokeAccess(params: {
    projectId: string;
    serverId: string;
    changedBy: string;
  }) {
    const existing = await this.projectsRepository.findAccessMapping(
      params.projectId,
      params.serverId,
    );
    if (!existing) {
      throw new NotFoundException('Project-server access mapping not found');
    }

    await this.projectsRepository.revokeAccessMapping(
      params.projectId,
      params.serverId,
    );

    await this.projectsRepository.insertAuditEntry({
      projectId: params.projectId,
      serverId: params.serverId,
      action: 'REVOKE',
      operationsBefore: existing.operations,
      operationsAfter: null,
      changedBy: params.changedBy,
      changedAt: new Date(),
    });

    await this.invalidateProjectServerAccess(params.projectId, params.serverId);

    return {
      revoked: true,
      projectId: params.projectId,
      serverId: params.serverId,
    };
  }

  async canProjectAccessOperation(
    projectId: string,
    serverId: string,
    operation: ProjectServerOperation,
  ): Promise<boolean> {
    const accessState = await this.resolveProjectServerAccessState(
      projectId,
      serverId,
    );

    return Boolean(
      accessState?.serverIsActive && accessState.operations?.[operation],
    );
  }

  async assertProjectServerRequestAccess(params: {
    projectId: string;
    serverId: string;
    operation: ProjectServerOperation;
    requiredScope?: string;
  }): Promise<void> {
    const accessState = await this.resolveProjectServerAccessState(
      params.projectId,
      params.serverId,
    );

    if (!accessState || !accessState.serverIsActive) {
      throw new ForbiddenException('Server not found or inactive');
    }

    if (!accessState.operations?.[params.operation]) {
      throw new ForbiddenException(
        `Project is not allowed to perform ${params.operation} on server ${params.serverId}`,
      );
    }

    if (
      params.requiredScope &&
      (!Array.isArray(accessState.scopes) ||
        !accessState.scopes.includes(params.requiredScope))
    ) {
      throw new ForbiddenException(
        `Insufficient scope: '${params.requiredScope}' is required`,
      );
    }
  }

  async assertProjectAccessOperation(
    projectId: string,
    serverId: string,
    operation: ProjectServerOperation,
  ): Promise<void> {
    await this.assertProjectServerRequestAccess({
      projectId,
      serverId,
      operation,
    });
  }

  async listServersByProject(
    projectId: string,
    filters?: ListServersByProjectFilters,
  ) {
    return this.projectsRepository.listServersByProject(projectId, filters);
  }

  async listProjectsByServer(
    serverId: string,
    filters?: ListProjectsByServerFilters,
  ) {
    return this.projectsRepository.listProjectsByServer(serverId, filters);
  }

  async listAccessMatrix(filters?: ListAccessMatrixFilters) {
    return this.projectsRepository.listAccessMatrix(filters);
  }

  async listAudit(filters: ListAuditFilters = {}) {
    const safeLimit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    return this.projectsRepository.listAudit({ ...filters, limit: safeLimit });
  }

  private async resolveProjectServerAccessState(
    projectId: string,
    serverId: string,
  ): Promise<ProjectServerAccessState | null> {
    const cached = await this.projectAccessCache.get(projectId, serverId);
    if (cached) {
      return {
        serverId: cached.serverId,
        serverIsActive: true,
        operations: cached.operations,
        scopes: cached.scopes,
      };
    }

    const dbState = await this.projectsRepository.findProjectServerAccessState(
      projectId,
      serverId,
    );

    if (dbState?.serverIsActive && dbState.operations) {
      await this.projectAccessCache.set({
        projectId,
        serverId,
        operations: dbState.operations,
        scopes: dbState.scopes ?? [],
      });
    }

    return dbState;
  }

  private async invalidateProjectServerAccess(
    projectId: string,
    serverId: string,
  ): Promise<void> {
    await Promise.all([
      this.projectAccessCache.invalidateProject(projectId),
      this.projectAccessCache.invalidateServer(serverId),
    ]);
  }

  private async invalidateProjectCaches(projectId: string): Promise<void> {
    await Promise.all([
      this.projectAuthCache.invalidateProject(projectId),
      this.projectAccessCache.invalidateProject(projectId),
    ]);
  }
}
