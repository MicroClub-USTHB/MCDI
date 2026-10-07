import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  AccessLevel,
  AccessResource,
  GrantLevel,
} from '../../common/permissions/catalog';
import type {
  MemberOverride,
  RoleGrant,
} from '../../common/permissions/resolve-access';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';

export interface ServerRoleRow {
  id: string;
  name: string;
  position: number | null;
}

@Injectable()
export class AdminAccessRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findMainServerId(): Promise<string | null> {
    const [row] = await this.db
      .select({ id: schema.servers.id })
      .from(schema.servers)
      .where(eq(schema.servers.isMain, true))
      .limit(1);
    return row?.id ?? null;
  }

  /** The member's role ids that belong to the given server. */
  async findMemberRoleIdsInServer(
    memberId: string,
    serverId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ roleId: schema.roles.id })
      .from(schema.serverMemberRoles)
      .innerJoin(
        schema.roles,
        and(
          eq(schema.serverMemberRoles.roleId, schema.roles.id),
          eq(schema.roles.serverId, serverId),
        ),
      )
      .where(eq(schema.serverMemberRoles.memberId, memberId));
    return rows.map((r) => r.roleId);
  }

  async findGrantsForRoles(roleIds: string[]): Promise<RoleGrant[]> {
    if (roleIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(schema.adminRoleAccess)
      .where(inArray(schema.adminRoleAccess.roleId, roleIds));
    return rows.map((r) => ({
      roleId: r.roleId,
      resource: r.resource as AccessResource,
      level: r.level,
    }));
  }

  async findMemberOverrides(memberId: string): Promise<MemberOverride[]> {
    const rows = await this.db
      .select()
      .from(schema.adminMemberAccess)
      .where(eq(schema.adminMemberAccess.memberId, memberId));
    return rows.map((r) => ({
      resource: r.resource as AccessResource,
      level: r.level,
    }));
  }

  async listServerRoles(serverId: string): Promise<ServerRoleRow[]> {
    return this.db
      .select({
        id: schema.roles.id,
        name: schema.roles.name,
        position: schema.roles.position,
      })
      .from(schema.roles)
      .where(eq(schema.roles.serverId, serverId));
  }

  async findRole(
    roleId: string,
  ): Promise<{ id: string; serverId: string; name: string } | null> {
    const [row] = await this.db
      .select({
        id: schema.roles.id,
        serverId: schema.roles.serverId,
        name: schema.roles.name,
      })
      .from(schema.roles)
      .where(eq(schema.roles.id, roleId))
      .limit(1);
    return row ?? null;
  }

  async memberExists(memberId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(eq(schema.members.id, memberId))
      .limit(1);
    return Boolean(row);
  }

  /** Replaces all grants of a role in one transaction. */
  async replaceRoleGrants(
    roleId: string,
    grants: Array<{ resource: AccessResource; level: GrantLevel }>,
    updatedBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.adminRoleAccess)
        .where(eq(schema.adminRoleAccess.roleId, roleId));
      if (grants.length > 0) {
        await tx.insert(schema.adminRoleAccess).values(
          grants.map((g) => ({
            roleId,
            resource: g.resource,
            level: g.level,
            updatedBy,
          })),
        );
      }
    });
  }

  /** Replaces all overrides of a member in one transaction. */
  async replaceMemberOverrides(
    memberId: string,
    overrides: Array<{ resource: AccessResource; level: AccessLevel }>,
    updatedBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.adminMemberAccess)
        .where(eq(schema.adminMemberAccess.memberId, memberId));
      if (overrides.length > 0) {
        await tx.insert(schema.adminMemberAccess).values(
          overrides.map((o) => ({
            memberId,
            resource: o.resource,
            level: o.level,
            updatedBy,
          })),
        );
      }
    });
  }

  /** Returns false when the member had no override for that resource. */
  async deleteMemberOverride(
    memberId: string,
    resource: AccessResource,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(schema.adminMemberAccess)
      .where(
        and(
          eq(schema.adminMemberAccess.memberId, memberId),
          eq(schema.adminMemberAccess.resource, resource),
        ),
      )
      .returning({ resource: schema.adminMemberAccess.resource });
    return rows.length > 0;
  }
}
