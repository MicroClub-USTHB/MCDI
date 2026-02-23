import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProjectServerOperations } from '../../database/entities/project-server.entity';
import { ProjectsAccessRepository } from './projects-access.repository';
import {
  DEFAULT_PROJECT_SERVER_OPERATIONS,
  type ProjectServerOperation,
} from './projects-access.types';

@Injectable()
export class ProjectsAccessService {
  constructor(private readonly repository: ProjectsAccessRepository) {}

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
    changedBy: string;
  }) {
    const project = await this.repository.findProjectById(params.projectId);
    if (!project) throw new NotFoundException('Project not found');

    const server = await this.repository.findServerById(params.serverId);
    if (!server) throw new NotFoundException('Server not found');

    const before = await this.repository.findAccessMapping(
      params.projectId,
      params.serverId,
    );
    const now = new Date();
    const normalizedOps = this.normalizeOperations(params.operations);

    const saved = await this.repository.upsertAccessMapping(
      params.projectId,
      params.serverId,
      normalizedOps,
      now,
    );

    await this.repository.insertAuditEntry({
      projectId: params.projectId,
      serverId: params.serverId,
      action: before ? 'UPDATE' : 'GRANT',
      operationsBefore: (before?.operations as ProjectServerOperations) ?? null,
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
    const existing = await this.repository.findAccessMapping(
      params.projectId,
      params.serverId,
    );
    if (!existing) {
      throw new NotFoundException('Project-server access mapping not found');
    }

    await this.repository.revokeAccessMapping(
      params.projectId,
      params.serverId,
    );

    await this.repository.insertAuditEntry({
      projectId: params.projectId,
      serverId: params.serverId,
      action: 'REVOKE',
      operationsBefore: existing.operations as ProjectServerOperations,
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
    return this.repository.isOperationAllowed(projectId, serverId, operation);
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
    return this.repository.listServersByProject(projectId);
  }

  async listProjectsByServer(serverId: string) {
    return this.repository.listProjectsByServer(serverId);
  }

  async listAccessMatrix() {
    return this.repository.listAccessMatrix();
  }

  async listAudit(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.repository.listAudit(safeLimit);
  }
}
