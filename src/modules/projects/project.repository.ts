import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import { verifyApiKey } from '../../common/utils/api-key.util';

@Injectable()
export class ProjectRepository {
  constructor(@Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>) {}

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

  /** Get the main Discord server (isMain = true) */
  async findMainServer() {
    const results = await this.db
      .select()
      .from(schema.servers)
      .where(eq(schema.servers.isMain, true))
      .limit(1);

    return results[0] || null;
  }

  /** Check if a member exists in a specific server */
  async isMemberInServer(memberId: string, serverId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(schema.serverMembers)
      .where(
        and(
          eq(schema.serverMembers.memberId, memberId),
          eq(schema.serverMembers.serverId, serverId),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  /** Get a member's role IDs in a specific server */
  async getMemberRolesInServer(memberId: string, serverId: string) {
    const rows = await this.db
      .select({
        roleId: schema.serverMemberRoles.roleId,
        roleName: schema.roles.name,
        roleColor: schema.roles.color,
        rolePosition: schema.roles.position,
      })
      .from(schema.serverMemberRoles)
      .innerJoin(
        schema.roles,
        eq(schema.serverMemberRoles.roleId, schema.roles.id),
      )
      .where(
        and(
          eq(schema.serverMemberRoles.memberId, memberId),
          eq(schema.roles.serverId, serverId),
        ),
      );

    return rows;
  }

  /** Check if a member holds any of the required roles */
  async memberHasAnyRole(
    memberId: string,
    roleIds: string[],
  ): Promise<boolean> {
    if (roleIds.length === 0) return true; // No role restriction

    const rows = await this.db
      .select()
      .from(schema.serverMemberRoles)
      .where(
        and(
          eq(schema.serverMemberRoles.memberId, memberId),
          inArray(schema.serverMemberRoles.roleId, roleIds),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  /** Find a server by its name */
  async findServerByName(name: string) {
    const results = await this.db
      .select()
      .from(schema.servers)
      .where(eq(schema.servers.name, name))
      .limit(1);

    return results[0] || null;
  }

  /** Check if a project has access to a specific server */
  async hasServerAccess(projectId: string, serverId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(schema.projectServers)
      .where(
        and(
          eq(schema.projectServers.projectId, projectId),
          eq(schema.projectServers.serverId, serverId),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  /** Validate redirect URI against project's allowed URIs */
  async isRedirectUriAllowed(
    projectId: string,
    redirectUri: string,
  ): Promise<boolean> {
    const project = await this.db
      .select({ redirectUri: schema.projects.redirectUri })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);

    if (!project[0]?.redirectUri) return false;

    // Support comma-separated list of allowed URIs
    const allowedUris = project[0].redirectUri
      .split(',')
      .map((uri) => uri.trim());

    return allowedUris.includes(redirectUri);
  }

  /**
   * Sync a member's server membership and Discord roles into the MCDI DB.
   * Called during OAuth callback so roles are always up-to-date.
   */
  async syncMemberServerData(
    memberId: string,
    serverId: string,
    discordRoles: {
      id: string;
      name: string;
      color?: number;
      position?: number;
    }[],
  ): Promise<void> {
    // 1. Ensure server_members row exists
    await this.db
      .insert(schema.serverMembers)
      .values({ memberId, serverId, joinedAt: new Date() })
      .onConflictDoNothing();

    if (discordRoles.length === 0) return;

    // 2. Upsert roles into the roles table (Discord role ID is PK)
    await this.db
      .insert(schema.roles)
      .values(
        discordRoles.map((r) => ({
          id: r.id,
          serverId,
          name: r.name,
          color: r.color ?? null,
          position: r.position ?? 0,
        })),
      )
      .onConflictDoUpdate({
        target: schema.roles.id,
        set: {
          name: sql`excluded.name`,
          color: sql`excluded.color`,
          position: sql`excluded.position`,
          updatedAt: new Date(),
        },
      });

    // 3. Upsert server_member_roles
    await this.db
      .insert(schema.serverMemberRoles)
      .values(
        discordRoles.map((r) => ({
          memberId,
          roleId: r.id,
        })),
      )
      .onConflictDoNothing();
  }

  /** Update redirect URI for a project */
  async updateRedirectUri(projectId: string, redirectUri: string) {
    const projects = await this.db
      .update(schema.projects)
      .set({ redirectUri, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId))
      .returning();

    return projects[0] || null;
  }

  /** Regenerate API key for a project */
  async regenerateApiKey(
    projectId: string,
    newHash: string,
    newPrefix: string,
  ) {
    const projects = await this.db
      .update(schema.projects)
      .set({
        apiKeyHash: newHash,
        apiKeyPrefix: newPrefix,
        apiKeyCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
      .returning();

    return projects[0] || null;
  }
}
