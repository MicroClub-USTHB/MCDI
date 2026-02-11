import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

@Injectable()
export class ProjectRepository {
    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    ) { }

    /** Find a project by its API key */
    async findByApiKey(apiKey: string) {
        const results = await this.db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.apiKey, apiKey))
            .limit(1);

        return results[0] || null;
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
        const rows = await this.db
            .select({
                roleId: schema.projectRoles.roleId,
                roleName: schema.roles.name,
                roleColor: schema.roles.color,
                rolePosition: schema.roles.position,
            })
            .from(schema.projectRoles)
            .innerJoin(schema.roles, eq(schema.projectRoles.roleId, schema.roles.id))
            .where(eq(schema.projectRoles.projectId, projectId));

        return rows;
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
            .innerJoin(schema.roles, eq(schema.serverMemberRoles.roleId, schema.roles.id))
            .where(
                and(
                    eq(schema.serverMemberRoles.memberId, memberId),
                    eq(schema.roles.serverId, serverId),
                ),
            );

        return rows;
    }

    /** Check if a member holds any of the required roles */
    async memberHasAnyRole(memberId: string, roleIds: string[]): Promise<boolean> {
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
}
