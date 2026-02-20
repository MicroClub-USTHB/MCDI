import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import * as databaseModule from '../../database/database.module';
import {
  projectServerAccessAudit,
  projectServers,
  projects,
  servers,
} from '../../database/entities';
import type { ProjectServerOperations } from '../../database/entities/project-server.entity';
import type { ProjectServerOperation } from './projects-access.types';

type AccessAuditAction = 'GRANT' | 'UPDATE' | 'REVOKE';

@Injectable()
export class ProjectsAccessRepository {
  constructor(
    @Inject(databaseModule.DRIZZLE)
    private readonly db: databaseModule.DrizzleDB,
  ) {}

  async findProjectById(projectId: string) {
    const [row] = await this.db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    return row ?? null;
  }

  async findServerById(serverId: string) {
    const [row] = await this.db
      .select({
        id: servers.id,
        name: servers.name,
        isActive: servers.isActive,
      })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    return row ?? null;
  }

  async findAccessMapping(projectId: string, serverId: string) {
    const [row] = await this.db
      .select()
      .from(projectServers)
      .where(
        and(
          eq(projectServers.projectId, projectId),
          eq(projectServers.serverId, serverId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async upsertAccessMapping(
    projectId: string,
    serverId: string,
    operations: ProjectServerOperations,
    now: Date,
  ) {
    const [row] = await this.db
      .insert(projectServers)
      .values({
        projectId,
        serverId,
        operations,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [projectServers.projectId, projectServers.serverId],
        set: {
          operations,
          updatedAt: now,
        },
      })
      .returning();

    return row;
  }

  async revokeAccessMapping(projectId: string, serverId: string) {
    const [row] = await this.db
      .delete(projectServers)
      .where(
        and(
          eq(projectServers.projectId, projectId),
          eq(projectServers.serverId, serverId),
        ),
      )
      .returning();

    return row ?? null;
  }

  async insertAuditEntry(params: {
    projectId: string;
    serverId: string;
    action: AccessAuditAction;
    operationsBefore: ProjectServerOperations | null;
    operationsAfter: ProjectServerOperations | null;
    changedBy: string;
    changedAt: Date;
  }) {
    await this.db.insert(projectServerAccessAudit).values({
      projectId: params.projectId,
      serverId: params.serverId,
      action: params.action,
      operationsBefore: params.operationsBefore,
      operationsAfter: params.operationsAfter,
      changedBy: params.changedBy,
      changedAt: params.changedAt,
    });
  }

  async isOperationAllowed(
    projectId: string,
    serverId: string,
    operation: ProjectServerOperation,
  ): Promise<boolean> {
    const access = await this.findAccessMapping(projectId, serverId);
    if (!access) return false;

    const operations = access.operations as ProjectServerOperations;
    return Boolean(operations?.[operation]);
  }

  async listServersByProject(projectId: string) {
    return this.db
      .select({
        projectId: projectServers.projectId,
        serverId: servers.id,
        serverName: servers.name,
        operations: projectServers.operations,
        updatedAt: projectServers.updatedAt,
      })
      .from(projectServers)
      .innerJoin(servers, eq(servers.id, projectServers.serverId))
      .where(eq(projectServers.projectId, projectId))
      .orderBy(servers.name);
  }

  async listProjectsByServer(serverId: string) {
    return this.db
      .select({
        serverId: projectServers.serverId,
        projectId: projects.id,
        projectName: projects.name,
        operations: projectServers.operations,
        updatedAt: projectServers.updatedAt,
      })
      .from(projectServers)
      .innerJoin(projects, eq(projects.id, projectServers.projectId))
      .where(eq(projectServers.serverId, serverId))
      .orderBy(projects.name);
  }

  async listAccessMatrix() {
    return this.db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        serverId: servers.id,
        serverName: servers.name,
        operations: projectServers.operations,
        updatedAt: projectServers.updatedAt,
      })
      .from(projectServers)
      .innerJoin(projects, eq(projects.id, projectServers.projectId))
      .innerJoin(servers, eq(servers.id, projectServers.serverId))
      .orderBy(projects.name, servers.name);
  }

  async listAudit(limit = 100) {
    return this.db
      .select()
      .from(projectServerAccessAudit)
      .orderBy(desc(projectServerAccessAudit.changedAt))
      .limit(limit);
  }
}
