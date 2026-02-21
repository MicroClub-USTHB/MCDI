import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import * as databaseModule from '../../database/database.module';
import {
  memberGlobalPermissions,
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
      .where(sql`lower(${permissions.name}) = lower(${permissionName})`)
      .limit(1);

    return row?.id ?? null;
  }

  async hasGlobalPermission(
    memberId: string,
    permissionId: number,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ memberId: memberGlobalPermissions.memberId })
      .from(memberGlobalPermissions)
      .where(
        and(
          eq(memberGlobalPermissions.memberId, memberId),
          eq(memberGlobalPermissions.permissionId, permissionId),
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

  async listInheritanceRules() {
    const rows = await this.db
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
      );

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

    return Array.from(byId.values()).sort((a, b) => b.id - a.id);
  }
}
