import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';

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

  async update(id: string, data: UpdateProjectData): Promise<ProjectRow | null> {
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
      await this.db.insert(schema.projectScopes).values(
        scopes.map((scope) => ({ projectId, scope })),
      );
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
}
