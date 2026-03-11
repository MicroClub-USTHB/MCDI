import {
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
  ProjectsRepository,
  ProjectRow,
} from './projects.repository';

export interface CreateProjectResult {
  /** Returned ONCE — never stored in plaintext, never returned again */
  apiKey: string;
  project: ProjectRow;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async create(dto: CreateProjectDto): Promise<CreateProjectResult> {
    const { fullKey, prefix, hash } = generateApiKey();

    const project = await this.projectsRepository.create({
      name: dto.name,
      description: dto.description,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
    });

    let serverAccessConfig = dto.serverAccess ?? [];

    if (serverAccessConfig.length === 0) {
      const mainServers = await this.projectsRepository.findMainServers();
      serverAccessConfig = mainServers.map((s) => ({
        serverId: s.id,
        scopes: Object.values(ProjectScope),
      }));
    }

    const now = new Date();
    for (const access of serverAccessConfig) {
      const server = await this.projectsRepository.findServerById(
        access.serverId,
      );
      if (!server) continue; // skip invalid server IDs silently

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

  async findAll(): Promise<ProjectRow[]> {
    return this.projectsRepository.findAll();
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
    // Update name/description if provided
    const project = await this.projectsRepository.update(id, {
      name: dto.name,
      description: dto.description,
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);

    return this.findOne(id);
  }

  async revokeKey(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.projectsRepository.setActive(id, false);
  }

  async restoreKey(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.projectsRepository.setActive(id, true);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.projectsRepository.delete(id);
    if (!deleted) throw new NotFoundException(`Project ${id} not found`);
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
    return this.projectsRepository.isOperationAllowed(
      projectId,
      serverId,
      operation,
    );
  }

  async assertProjectAccessOperation(
    projectId: string,
    serverId: string,
    operation: ProjectServerOperation,
  ): Promise<void> {
    const allowed = await this.canProjectAccessOperation(
      projectId,
      serverId,
      operation,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `Project is not allowed to perform ${operation} on server ${serverId}`,
      );
    }
  }

  async listServersByProject(projectId: string) {
    return this.projectsRepository.listServersByProject(projectId);
  }

  async listProjectsByServer(serverId: string) {
    return this.projectsRepository.listProjectsByServer(serverId);
  }

  async listAccessMatrix() {
    return this.projectsRepository.listAccessMatrix();
  }

  async listAudit(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.projectsRepository.listAudit(safeLimit);
  }
}
