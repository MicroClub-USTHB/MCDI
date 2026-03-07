import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';
import { verifyApiKey } from '../../../common/utils/api-key.util';

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
}
