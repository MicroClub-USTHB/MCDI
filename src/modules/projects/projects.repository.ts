import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import {
  projectServerAccessAudit,
  projectServers,
  projects,
  servers,
} from '../../database/entities';
import type { ProjectServerOperations } from '../../database/entities/project-server.entity';
import { verifyApiKey } from '../../common/utils/api-key.util';

// ─── Project-Server Access Types ──────────────────────────────────────────

export const PROJECT_SERVER_OPERATION_VALUES = [
  'READ',
  'SEND_MESSAGES',
  'MANAGE_WEBHOOKS',
] as const;

export type ProjectServerOperation =
  (typeof PROJECT_SERVER_OPERATION_VALUES)[number];

export const DEFAULT_PROJECT_SERVER_OPERATIONS: ProjectServerOperations = {
  READ: true,
  SEND_MESSAGES: false,
  MANAGE_WEBHOOKS: false,
};

export const isProjectServerOperation = (
  value: string,
): value is ProjectServerOperation =>
  (PROJECT_SERVER_OPERATION_VALUES as readonly string[]).includes(value);

type AccessAuditAction = 'GRANT' | 'UPDATE' | 'REVOKE';

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  apiKeyPrefix: string | null;
  apiKeyCreatedAt: Date;
  apiKeyLastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  scopes: string[];
}

export interface CreateProjectData {
  name: string;
  description?: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  scopes: string[];
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
}

@Injectable()
export class ProjectsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: CreateProjectData): Promise<ProjectRow> {
    const [project] = await this.db
      .insert(schema.projects)
      .values({
        name: data.name,
        description: data.description,
        apiKeyHash: data.apiKeyHash,
        apiKeyPrefix: data.apiKeyPrefix,
        isActive: true,
      })
      .returning();

    if (data.scopes.length > 0) {
      await this.db.insert(schema.projectScopes).values(
        data.scopes.map((scope) => ({
          projectId: project.id,
          scope,
        })),
      );
    }

    return this.toProjectRow(project, data.scopes);
  }

  async findAll(): Promise<ProjectRow[]> {
    const projects = await this.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        description: schema.projects.description,
        apiKeyPrefix: schema.projects.apiKeyPrefix,
        apiKeyCreatedAt: schema.projects.apiKeyCreatedAt,
        apiKeyLastUsedAt: schema.projects.apiKeyLastUsedAt,
        isActive: schema.projects.isActive,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects);

    const scopeMap = await this.getScopeMap(projects.map((p) => p.id));

    return projects.map((p) => ({
      ...p,
      scopes: scopeMap[p.id] ?? [],
    }));
  }

  async findOne(id: string): Promise<ProjectRow | null> {
    const [project] = await this.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        description: schema.projects.description,
        apiKeyPrefix: schema.projects.apiKeyPrefix,
        apiKeyCreatedAt: schema.projects.apiKeyCreatedAt,
        apiKeyLastUsedAt: schema.projects.apiKeyLastUsedAt,
        isActive: schema.projects.isActive,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return null;

    const scopes = await this.getScopesForProject(id);
    return { ...project, scopes };
  }

  async update(
    id: string,
    data: UpdateProjectData,
  ): Promise<ProjectRow | null> {
    const [project] = await this.db
      .update(schema.projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.projects.id, id))
      .returning({
        id: schema.projects.id,
        name: schema.projects.name,
        description: schema.projects.description,
        apiKeyPrefix: schema.projects.apiKeyPrefix,
        apiKeyCreatedAt: schema.projects.apiKeyCreatedAt,
        apiKeyLastUsedAt: schema.projects.apiKeyLastUsedAt,
        isActive: schema.projects.isActive,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      });

    if (!project) return null;

    const scopes = await this.getScopesForProject(id);
    return { ...project, scopes };
  }

  async replaceScopes(projectId: string, scopes: string[]): Promise<void> {
    await this.db
      .delete(schema.projectScopes)
      .where(eq(schema.projectScopes.projectId, projectId));

    if (scopes.length > 0) {
      await this.db
        .insert(schema.projectScopes)
        .values(scopes.map((scope) => ({ projectId, scope })));
    }
  }

  async updateKey(
    id: string,
    apiKeyHash: string,
    apiKeyPrefix: string,
  ): Promise<void> {
    await this.db
      .update(schema.projects)
      .set({
        apiKeyHash,
        apiKeyPrefix,
        apiKeyCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, id));
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db
      .update(schema.projects)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schema.projects.id, id));
  }

  // ─────────────────────────────── Delete ───────────────────────────────

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.projects)
      .where(eq(schema.projects.id, id))
      .returning({ id: schema.projects.id });

    return result.length > 0;
  }

  // ─────────────────────────────── Helpers ──────────────────────────────

  private async getScopesForProject(projectId: string): Promise<string[]> {
    const rows = await this.db
      .select({ scope: schema.projectScopes.scope })
      .from(schema.projectScopes)
      .where(eq(schema.projectScopes.projectId, projectId));

    return rows.map((r) => r.scope);
  }

  private async getScopeMap(
    projectIds: string[],
  ): Promise<Record<string, string[]>> {
    if (projectIds.length === 0) return {};

    const rows = await this.db
      .select({
        projectId: schema.projectScopes.projectId,
        scope: schema.projectScopes.scope,
      })
      .from(schema.projectScopes);

    return rows.reduce<Record<string, string[]>>((acc, row) => {
      if (!acc[row.projectId]) acc[row.projectId] = [];
      acc[row.projectId].push(row.scope);
      return acc;
    }, {});
  }

  private toProjectRow(
    project: typeof schema.projects.$inferSelect,
    scopes: string[],
  ): ProjectRow {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      apiKeyPrefix: project.apiKeyPrefix,
      apiKeyCreatedAt: project.apiKeyCreatedAt,
      apiKeyLastUsedAt: project.apiKeyLastUsedAt,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      scopes,
    };
  }

  // ─────────────────────── Auth-support queries ──────────────────────────

  /** Validate redirect URI against the project's allowed URI list */
  async isRedirectUriAllowed(
    projectId: string,
    redirectUri: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ redirectUri: schema.projects.redirectUri })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);

    if (!rows[0]?.redirectUri) return false;

    // Support comma-separated list of allowed URIs
    const allowedUris = rows[0].redirectUri.split(',').map((u) => u.trim());
    return allowedUris.includes(redirectUri);
  }

  /** Get the role IDs that are allowed to access a project */
  async findAllowedRoleIds(projectId: string): Promise<string[]> {
    const rows = await this.db
      .select({ roleId: schema.projectRoles.roleId })
      .from(schema.projectRoles)
      .where(eq(schema.projectRoles.projectId, projectId));

    return rows.map((r) => r.roleId);
  }

  /** Get the allowed roles with full role details */
  async findAllowedRoles(projectId: string) {
    return this.db
      .select({
        roleId: schema.projectRoles.roleId,
        roleName: schema.roles.name,
        roleColor: schema.roles.color,
        rolePosition: schema.roles.position,
      })
      .from(schema.projectRoles)
      .innerJoin(schema.roles, eq(schema.projectRoles.roleId, schema.roles.id))
      .where(eq(schema.projectRoles.projectId, projectId));
  }

  /** Find a project by its raw API key (prefix.secret format) */
  async findByApiKey(apiKey: string) {
    const dotIndex = apiKey.indexOf('.');
    if (dotIndex === -1) return null;
    const prefix = apiKey.substring(0, dotIndex);
    const secret = apiKey.substring(dotIndex + 1);
    if (!prefix || !secret) return null;

    const results = await this.db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.apiKeyPrefix, prefix),
          eq(schema.projects.isActive, true),
        ),
      )
      .limit(1);

    const project = results[0] || null;
    if (!project || !project.apiKeyHash) return null;
    return verifyApiKey(secret, project.apiKeyHash) ? project : null;
  }

  /** Update the allowed redirect URI(s) for a project */
  async updateRedirectUri(projectId: string, redirectUri: string) {
    const rows = await this.db
      .update(schema.projects)
      .set({ redirectUri, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId))
      .returning();
    return rows[0] || null;
  }

  /** Regenerate a project's API key, returning the updated project or null */
  async regenerateApiKey(
    projectId: string,
    newHash: string,
    newPrefix: string,
  ) {
    const rows = await this.db
      .update(schema.projects)
      .set({
        apiKeyHash: newHash,
        apiKeyPrefix: newPrefix,
        apiKeyCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
      .returning();

    return rows[0] || null;
  }

  // ─── Project-Server Access ────────────────────────────────────────────

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

    const operations = access.operations;
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
    const safeLimit = Math.max(limit, 1);
    return this.db
      .select()
      .from(projectServerAccessAudit)
      .orderBy(desc(projectServerAccessAudit.changedAt))
      .limit(safeLimit);
  }

  /** Return true if a project has been granted access to the given server */
  async hasServerAccess(projectId: string, serverId: string): Promise<boolean> {
    const row = await this.findAccessMapping(projectId, serverId);
    return row !== null;
  }
}
