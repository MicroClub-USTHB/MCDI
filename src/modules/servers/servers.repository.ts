import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import * as databaseModule from '../../database/database.module';
import {
  permissions,
  projectServers,
  rolePermissions,
  roles,
  serverMemberRoles,
  serverMembers,
  serverSyncLogs,
  servers,
} from '../../database/entities';

@Injectable()
export class ServersRepository {
  constructor(
    @Inject(databaseModule.DRIZZLE)
    private readonly db: databaseModule.DrizzleDB,
  ) { }

  async clearMainServer(now: Date) {
    await this.db
      .update(servers)
      .set({ isMain: false, updatedAt: now })
      .where(eq(servers.isMain, true));
  }

  async upsertServer(serverData: typeof servers.$inferInsert) {
    const [row] = await this.db
      .insert(servers)
      .values(serverData)
      .onConflictDoUpdate({
        target: servers.id,
        set: serverData,
      })
      .returning();

    return row;
  }

  async listServersWithLastSync() {
    const lastSyncSub = this.db
      .select({
        serverId: serverSyncLogs.serverId,
        lastSyncAt: sql`max(${serverSyncLogs.finishedAt})`.as('last_sync_at'),
      })
      .from(serverSyncLogs)
      .groupBy(serverSyncLogs.serverId)
      .as('last_sync');

    return this.db
      .select({
        id: servers.id,
        name: servers.name,
        icon: servers.icon,
        type: servers.type,
        isMain: servers.isMain,
        isActive: servers.isActive,
        syncFrequencyHours: servers.syncFrequencyHours,
        defaultPermissionPolicy: servers.defaultPermissionPolicy,
        disabledReason: servers.disabledReason,
        syncedAt: servers.syncedAt,
        lastSyncAt: lastSyncSub.lastSyncAt,
      })
      .from(servers)
      .leftJoin(lastSyncSub, eq(servers.id, lastSyncSub.serverId));
  }

  async findById(serverId: string) {
    const [row] = await this.db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    return row;
  }

  async updateById(
    serverId: string,
    patch: Partial<typeof servers.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(servers)
      .set(patch)
      .where(eq(servers.id, serverId))
      .returning();

    return row;
  }

  async deleteServerCascade(serverId: string) {
    const roleRows = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.serverId, serverId));

    const roleIds = roleRows.map((r) => r.id);

    if (roleIds.length > 0) {
      await this.db
        .delete(rolePermissions)
        .where(inArray(rolePermissions.roleId, roleIds));

      await this.db
        .delete(serverMemberRoles)
        .where(inArray(serverMemberRoles.roleId, roleIds));
    }

    await this.db
      .delete(projectServers)
      .where(eq(projectServers.serverId, serverId));
    await this.db
      .delete(serverSyncLogs)
      .where(eq(serverSyncLogs.serverId, serverId));
    await this.db
      .delete(serverMembers)
      .where(eq(serverMembers.serverId, serverId));
    await this.db.delete(roles).where(eq(roles.serverId, serverId));
    await this.db.delete(servers).where(eq(servers.id, serverId));
  }

  // role sync
  async upsertRole(
    roleData: Omit<typeof roles.$inferInsert, 'permissionsBits'> & { permissionsBits?: bigint },
  ): Promise<typeof roles.$inferSelect> {
    const [row] = await this.db
      .insert(roles)
      .values({
        ...roleData,
        permissionsBits: roleData.permissionsBits ?? 0n,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: roles.id,
        set: {
          name: roleData.name,
          color: roleData.color,
          hoist: roleData.hoist,
          position: roleData.position,
          managed: roleData.managed,
          mentionable: roleData.mentionable,
          permissionsBits: roleData.permissionsBits ?? 0n,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  /**
   * Resolves a Discord role's permission bitfield against the permissions table
   * and upserts the matching rows into role_permissions.
   * This replaces the full set for the given role so stale entries are removed.
   */
  async syncRolePermissions(roleId: string, permissionsBits: bigint): Promise<void> {
    // Load all known permissions
    const allPermissions = await this.db
      .select({ id: permissions.id, bitfield: permissions.bitfield })
      .from(permissions);

    // Which permissions does this role actually have?
    const matchingPermIds = allPermissions
      .filter((p) => p.bitfield !== null && (permissionsBits & p.bitfield) !== 0n)
      .map((p) => p.id);

    await this.db.transaction(async (tx) => {
      // Remove all existing permission links for this role
      await tx
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      // Insert fresh set (skip insert if no permissions matched)
      if (matchingPermIds.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(matchingPermIds.map((permissionId) => ({ roleId, permissionId })))
          .onConflictDoNothing();
      }
    });
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  async findAllActive(): Promise<typeof servers.$inferSelect[]> {
    return this.db
      .select()
      .from(servers)
      .where(eq(servers.isActive, true));
  }
}
