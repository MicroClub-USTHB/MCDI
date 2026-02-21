import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import * as databaseModule from '../../database/database.module';
import {
  memberGlobalPermissions,
  permissions,
  rolePermissions,
  roles,
  serverMemberRoles,
  serverMembers,
} from '../../database/entities';

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

  async hasGlobalPermission(memberId: string, permissionId: number): Promise<boolean> {
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
}
