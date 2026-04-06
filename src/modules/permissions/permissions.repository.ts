import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or, sql, SQL } from 'drizzle-orm';
import * as databaseModule from '../../database/database.module';
import {
  permissions,
  roleInheritanceRules,
  roleInheritanceRuleTargets,
  rolePermissions,
  roles,
  serverMemberRoles,
  serverMembers,
  servers,
} from '../../database/entities';

type UpsertInheritanceRuleInput = {
  sourceRoleId: string;
  targetScope: 'all' | 'selected';
  enabled: boolean;
  targetServerIds: string[];
  now: Date;
};

export interface ListInheritanceRulesFilters {
  sourceRoleId?: string;
  enabled?: boolean;
  targetScope?: string;
  serverId?: string;
}

@Injectable()
export class PermissionsRepository {
  constructor(
    @Inject(databaseModule.DRIZZLE)
    private readonly db: databaseModule.DrizzleDB,
  ) {}

  async findPermissionIdByName(permissionName: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, permissionName))
      .limit(1);

    return row?.id ?? null;
  }

  async hasGlobalRolePermission(
    memberId: string,
    permissionId: number,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ roleId: serverMemberRoles.roleId })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(serverMemberRoles.memberId, memberId),
          eq(roles.isGlobal, true),
          eq(rolePermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async hasServerPermission(
    memberId: string,
    serverId: string,
    permissionId: number,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ roleId: serverMemberRoles.roleId })
      .from(serverMembers)
      .innerJoin(
        serverMemberRoles,
        eq(serverMemberRoles.memberId, serverMembers.memberId),
      )
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(serverMembers.memberId, memberId),
          eq(serverMembers.serverId, serverId),
          eq(roles.serverId, serverId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  /**
   * F6 gap closure: vertical hierarchy inheritance within a single server.
   * If a member holds a role at hierarchyLevel N, they also get permissions
   * from all roles with a LOWER hierarchyLevel (higher hierarchyLevel number = lower rank)
   * in the same server.
   * Convention: lower hierarchyLevel value = higher rank (e.g. Executive=1, Lead=2, Member=3).
   */
  async hasHierarchyPermission(
    memberId: string,
    serverId: string,
    permissionId: number,
  ): Promise<boolean> {
    // Find the highest rank (lowest hierarchyLevel) the member holds in this server
    const memberRoles = await this.db
      .select({ hierarchyLevel: roles.hierarchyLevel })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .where(
        and(
          eq(serverMemberRoles.memberId, memberId),
          eq(roles.serverId, serverId),
          sql`${roles.hierarchyLevel} IS NOT NULL`,
        ),
      );

    if (!memberRoles.length) return false;

    const highestRank = Math.min(...memberRoles.map((r) => r.hierarchyLevel!));

    // Check if any role at a lower rank (higher or equal hierarchyLevel number)
    // in this server has the requested permission
    const [row] = await this.db
      .select({ roleId: roles.id })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(roles.serverId, serverId),
          sql`${roles.hierarchyLevel} IS NOT NULL`,
          sql`${roles.hierarchyLevel} >= ${highestRank}`,
          eq(rolePermissions.permissionId, permissionId),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  /**
   * F6 gap closure: list all permission names the member inherits via hierarchy
   * (from lower-ranked roles in the same server).
   */
  async listHierarchyPermissionNames(
    memberId: string,
    serverId: string,
  ): Promise<string[]> {
    const memberRoles = await this.db
      .select({ hierarchyLevel: roles.hierarchyLevel })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .where(
        and(
          eq(serverMemberRoles.memberId, memberId),
          eq(roles.serverId, serverId),
          sql`${roles.hierarchyLevel} IS NOT NULL`,
        ),
      );

    if (!memberRoles.length) return [];

    const highestRank = Math.min(...memberRoles.map((r) => r.hierarchyLevel!));

    const rows = await this.db
      .select({ name: permissions.key })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(
          eq(roles.serverId, serverId),
          sql`${roles.hierarchyLevel} IS NOT NULL`,
          sql`${roles.hierarchyLevel} >= ${highestRank}`,
        ),
      );

    return Array.from(new Set(rows.map((r) => r.name)));
  }

  async getMainServerId(): Promise<string | null> {
    const [row] = await this.db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.isMain, true))
      .limit(1);

    return row?.id ?? null;
  }
  async getRoleServerId(roleId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ serverId: roles.serverId })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return row?.serverId ?? null;
  }

  async findMissingServerIds(serverIds: string[]): Promise<string[]> {
    if (!serverIds.length) return [];

    const rows = await this.db
      .select({ id: servers.id })
      .from(servers)
      .where(inArray(servers.id, serverIds));

    const existing = new Set(rows.map((r) => r.id));
    return serverIds.filter((id) => !existing.has(id));
  }

  async hasInheritedPermission(
    memberId: string,
    serverId: string,
    permissionId: number,
  ): Promise<boolean> {
    const mainServerId = await this.getMainServerId();
    if (!mainServerId || mainServerId === serverId) return false;

    const inheritedRoleRows = await this.db
      .select({ roleName: roles.name })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .innerJoin(
        roleInheritanceRules,
        and(
          eq(roleInheritanceRules.sourceRoleId, roles.id),
          eq(roleInheritanceRules.enabled, true),
        ),
      )
      .leftJoin(
        roleInheritanceRuleTargets,
        and(
          eq(roleInheritanceRuleTargets.ruleId, roleInheritanceRules.id),
          eq(roleInheritanceRuleTargets.targetServerId, serverId),
        ),
      )
      .where(
        and(
          eq(serverMemberRoles.memberId, memberId),
          eq(roles.serverId, mainServerId),
          or(
            eq(roleInheritanceRules.targetScope, 'all'),
            and(
              eq(roleInheritanceRules.targetScope, 'selected'),
              eq(roleInheritanceRuleTargets.targetServerId, serverId),
            ),
          ),
        ),
      );

    if (!inheritedRoleRows.length) return false;

    const inheritedRoleNames = new Set(
      inheritedRoleRows.map((r) => r.roleName.trim().toLowerCase()),
    );

    const targetRolePermissionRows = await this.db
      .select({ roleName: roles.name })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(roles.serverId, serverId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      );

    return targetRolePermissionRows.some((r) =>
      inheritedRoleNames.has(r.roleName.trim().toLowerCase()),
    );
  }

  async upsertInheritanceRule(input: UpsertInheritanceRuleInput) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: roleInheritanceRules.id })
        .from(roleInheritanceRules)
        .where(eq(roleInheritanceRules.sourceRoleId, input.sourceRoleId))
        .limit(1);

      let ruleId: number;

      if (existing) {
        ruleId = existing.id;
        await tx
          .update(roleInheritanceRules)
          .set({
            targetScope: input.targetScope,
            enabled: input.enabled,
            updatedAt: input.now,
          })
          .where(eq(roleInheritanceRules.id, ruleId));
      } else {
        const [inserted] = await tx
          .insert(roleInheritanceRules)
          .values({
            sourceRoleId: input.sourceRoleId,
            targetScope: input.targetScope,
            enabled: input.enabled,
            createdAt: input.now,
            updatedAt: input.now,
          })
          .returning({ id: roleInheritanceRules.id });

        ruleId = inserted.id;
      }

      await tx
        .delete(roleInheritanceRuleTargets)
        .where(eq(roleInheritanceRuleTargets.ruleId, ruleId));

      if (
        input.targetScope === 'selected' &&
        input.targetServerIds.length > 0
      ) {
        await tx.insert(roleInheritanceRuleTargets).values(
          input.targetServerIds.map((targetServerId) => ({
            ruleId,
            targetServerId,
          })),
        );
      }

      return {
        id: ruleId,
        sourceRoleId: input.sourceRoleId,
        targetScope: input.targetScope,
        enabled: input.enabled,
        targetServerIds:
          input.targetScope === 'selected' ? input.targetServerIds : [],
      };
    });
  }

  async listInheritanceRules(filters: ListInheritanceRulesFilters = {}) {
    const conditions: SQL[] = [];

    if (filters.sourceRoleId) {
      conditions.push(
        eq(roleInheritanceRules.sourceRoleId, filters.sourceRoleId),
      );
    }
    if (filters.enabled !== undefined) {
      conditions.push(eq(roleInheritanceRules.enabled, filters.enabled));
    }
    if (filters.targetScope) {
      conditions.push(
        eq(roleInheritanceRules.targetScope, filters.targetScope),
      );
    }

    const baseQuery = this.db
      .select({
        id: roleInheritanceRules.id,
        sourceRoleId: roleInheritanceRules.sourceRoleId,
        targetScope: roleInheritanceRules.targetScope,
        enabled: roleInheritanceRules.enabled,
        updatedAt: roleInheritanceRules.updatedAt,
        targetServerId: roleInheritanceRuleTargets.targetServerId,
      })
      .from(roleInheritanceRules)
      .leftJoin(
        roleInheritanceRuleTargets,
        eq(roleInheritanceRuleTargets.ruleId, roleInheritanceRules.id),
      )
      .$dynamic();

    const rows = await (conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery);

    const byId = new Map<
      number,
      {
        id: number;
        sourceRoleId: string;
        targetScope: string;
        enabled: boolean;
        updatedAt: Date;
        targetServerIds: string[];
      }
    >();

    for (const row of rows) {
      const current = byId.get(row.id);
      if (!current) {
        byId.set(row.id, {
          id: row.id,
          sourceRoleId: row.sourceRoleId,
          targetScope: row.targetScope,
          enabled: row.enabled,
          updatedAt: row.updatedAt,
          targetServerIds: row.targetServerId ? [row.targetServerId] : [],
        });
        continue;
      }

      if (
        row.targetServerId &&
        !current.targetServerIds.includes(row.targetServerId)
      ) {
        current.targetServerIds.push(row.targetServerId);
      }
    }

    return Array.from(byId.values())
      .sort((a, b) => b.id - a.id)
      .filter((rule) => {
        if (!filters.serverId) return true;
        return (
          rule.targetScope === 'all' ||
          rule.targetServerIds.includes(filters.serverId)
        );
      });
  }
  async listGlobalPermissionNames(memberId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: permissions.key })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(eq(serverMemberRoles.memberId, memberId), eq(roles.isGlobal, true)),
      );

    return Array.from(new Set(rows.map((r) => r.name)));
  }

  async listServerPermissionNames(
    memberId: string,
    serverId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ name: permissions.key })
      .from(serverMembers)
      .innerJoin(
        serverMemberRoles,
        eq(serverMemberRoles.memberId, serverMembers.memberId),
      )
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(
          eq(serverMembers.memberId, memberId),
          eq(serverMembers.serverId, serverId),
          eq(roles.serverId, serverId),
        ),
      );

    return Array.from(new Set(rows.map((r) => r.name)));
  }

  async listInheritedPermissionNames(
    memberId: string,
    serverId: string,
  ): Promise<string[]> {
    const mainServerId = await this.getMainServerId();
    if (!mainServerId || mainServerId === serverId) return [];

    const inheritedRoleRows = await this.db
      .select({ roleName: roles.name })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .innerJoin(
        roleInheritanceRules,
        and(
          eq(roleInheritanceRules.sourceRoleId, roles.id),
          eq(roleInheritanceRules.enabled, true),
        ),
      )
      .leftJoin(
        roleInheritanceRuleTargets,
        and(
          eq(roleInheritanceRuleTargets.ruleId, roleInheritanceRules.id),
          eq(roleInheritanceRuleTargets.targetServerId, serverId),
        ),
      )
      .where(
        and(
          eq(serverMemberRoles.memberId, memberId),
          eq(roles.serverId, mainServerId),
          or(
            eq(roleInheritanceRules.targetScope, 'all'),
            and(
              eq(roleInheritanceRules.targetScope, 'selected'),
              eq(roleInheritanceRuleTargets.targetServerId, serverId),
            ),
          ),
        ),
      );

    if (!inheritedRoleRows.length) return [];

    const inheritedRoleNames = new Set(
      inheritedRoleRows.map((r) => r.roleName.trim().toLowerCase()),
    );

    const targetRows = await this.db
      .select({
        roleName: roles.name,
        permissionName: permissions.key,
      })
      .from(roles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(roles.serverId, serverId));

    return Array.from(
      new Set(
        targetRows
          .filter((r) =>
            inheritedRoleNames.has(r.roleName.trim().toLowerCase()),
          )
          .map((r) => r.permissionName),
      ),
    );
  }

  async getRoleWithServer(roleId: string): Promise<{
    id: string;
    serverId: string;
    name: string;
    isGlobal: boolean;
    hierarchyLevel: number | null;
  } | null> {
    const [row] = await this.db
      .select({
        id: roles.id,
        serverId: roles.serverId,
        name: roles.name,
        isGlobal: roles.isGlobal,
        hierarchyLevel: roles.hierarchyLevel,
      })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return row ?? null;
  }

  async getPermissionsByRole(
    roleId: string,
  ): Promise<{ id: number; key: string; description: string | null }[]> {
    const rows = await this.db
      .select({
        id: permissions.id,
        key: permissions.key,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, roleId));

    return rows;
  }

  async addPermissionsToRole(
    roleId: string,
    permissionIds: number[],
  ): Promise<void> {
    if (!permissionIds.length) return;

    await this.db
      .insert(rolePermissions)
      .values(permissionIds.map((permissionId) => ({ roleId, permissionId })))
      .onConflictDoNothing();
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: number,
  ): Promise<void> {
    await this.db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      );
  }

  async getMembersByRole(roleId: string): Promise<string[]> {
    const rows = await this.db
      .select({ memberId: serverMemberRoles.memberId })
      .from(serverMemberRoles)
      .where(eq(serverMemberRoles.roleId, roleId));

    return rows.map((r) => r.memberId);
  }

  async getMinHierarchyLevelInServer(serverId: string): Promise<number | null> {
    const [row] = await this.db
      .select({ minLevel: roles.hierarchyLevel })
      .from(roles)
      .where(
        and(
          eq(roles.serverId, serverId),
          sql`${roles.hierarchyLevel} IS NOT NULL`,
        ),
      )
      .orderBy(roles.hierarchyLevel)
      .limit(1);

    return row?.minLevel ?? null;
  }
}
