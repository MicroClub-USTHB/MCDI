import { Injectable, Logger } from '@nestjs/common';
import { Guild, Role } from 'discord.js';
import { ServersRepository } from '../../servers/servers.repository';
import { MemberRepository } from '../../members/member.repository';
import { SyncLogService } from './sync-log.service';
import { SyncChangeEntry } from '../sync-types';
import { withRetry } from '../sync-retry.util';
import { PermissionCacheService } from '../../permissions/permission-cache.service';

@Injectable()
export class RoleSyncService {
  private readonly logger = new Logger(RoleSyncService.name);

  constructor(
    private readonly serversRepository: ServersRepository,
    private readonly memberRepository: MemberRepository,
    private readonly syncLogService: SyncLogService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  /**
   * Discord's `position` IS the role hierarchy (@everyone = 0, top role = highest
   * position). We store the inverse convention used by the seeder and
   * `getMinHierarchyLevelInServer`: lower value = higher rank, top role = level 1.
   */
  private deriveHierarchyLevel(position: number, maxPosition: number): number {
    return maxPosition - position + 1;
  }

  /** Highest `position` among the guild's roles, falling back to the role's own. */
  private hierarchyLevelForRole(role: Role): number {
    const positions = [...role.guild.roles.cache.values()].map(
      (r) => r.position,
    );
    const maxPosition = positions.length
      ? Math.max(...positions)
      : role.position;
    return this.deriveHierarchyLevel(role.position, maxPosition);
  }

  /**
   * Fetch and upsert all roles for a guild during a full sync run.
   * Appends change entries to the shared buffer.
   */
  async syncAllRoles(
    guild: Guild,
    syncId: number,
    changeBuffer: SyncChangeEntry[],
  ): Promise<{ rolesSynced: number }> {
    this.logger.debug(`Fetching all roles for guild ${guild.id}`);
    const guildRoles = await guild.roles.fetch();
    const maxPosition = Math.max(
      0,
      ...[...guildRoles.values()].map((r) => r.position),
    );

    for (const [, role] of guildRoles) {
      await withRetry(
        () =>
          this.serversRepository.upsertRole({
            id: role.id,
            serverId: guild.id,
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            position: role.position,
            managed: role.managed,
            mentionable: role.mentionable,
            permissionsBits: role.permissions.bitfield,
            hierarchyLevel: this.deriveHierarchyLevel(
              role.position,
              maxPosition,
            ),
          }),
        `upsertRole(${role.id})`,
        this.logger,
      );
      await withRetry(
        () =>
          this.serversRepository.syncRolePermissions(
            role.id,
            role.permissions.bitfield,
          ),
        `syncRolePermissions(${role.id})`,
        this.logger,
      );

      changeBuffer.push({
        syncLogId: syncId,
        serverId: guild.id,
        entityType: 'role',
        entityId: role.id,
        action: 'updated',
        description: `Role synced: ${role.name}`,
        details: JSON.stringify({
          name: role.name,
          position: role.position,
          managed: role.managed,
        }),
      });
    }

    this.logger.log(`Upserted ${guildRoles.size} roles for server ${guild.id}`);
    await this.permissionCache.invalidateServer(guild.id);
    return { rolesSynced: guildRoles.size };
  }

  // ─── Real-time gateway event handlers ────────────────────────────────

  async handleRoleCreate(role: Role): Promise<void> {
    this.logger.debug(`Role created: ${role.id} in ${role.guild.id}`);
    await withRetry(
      () =>
        this.serversRepository.upsertRole({
          id: role.id,
          serverId: role.guild.id,
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          managed: role.managed,
          mentionable: role.mentionable,
          permissionsBits: role.permissions.bitfield,
          hierarchyLevel: this.hierarchyLevelForRole(role),
        }),
      `handleRoleCreate upsertRole(${role.id})`,
      this.logger,
    );
    await withRetry(
      () =>
        this.serversRepository.syncRolePermissions(
          role.id,
          role.permissions.bitfield,
        ),
      `handleRoleCreate syncRolePermissions(${role.id})`,
      this.logger,
    );
    await this.permissionCache.invalidateServer(role.guild.id);
    await this.syncLogService.recordEventChange(
      role.guild.id,
      'role',
      role.id,
      'added',
      `Role created: ${role.name}`,
    );
  }

  async handleRoleUpdate(role: Role): Promise<void> {
    this.logger.debug(`Role updated: ${role.id} in ${role.guild.id}`);
    await withRetry(
      () =>
        this.serversRepository.upsertRole({
          id: role.id,
          serverId: role.guild.id,
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          managed: role.managed,
          mentionable: role.mentionable,
          permissionsBits: role.permissions.bitfield,
          hierarchyLevel: this.hierarchyLevelForRole(role),
        }),
      `handleRoleUpdate upsertRole(${role.id})`,
      this.logger,
    );
    await withRetry(
      () =>
        this.serversRepository.syncRolePermissions(
          role.id,
          role.permissions.bitfield,
        ),
      `handleRoleUpdate syncRolePermissions(${role.id})`,
      this.logger,
    );
    await this.permissionCache.invalidateServer(role.guild.id);
    await this.syncLogService.recordEventChange(
      role.guild.id,
      'role',
      role.id,
      'updated',
      `Role updated: ${role.name}`,
    );
  }

  async handleRoleDelete(role: Role): Promise<void> {
    this.logger.debug(`Role deleted: ${role.id} from ${role.guild.id}`);
    await withRetry(
      () => this.memberRepository.deleteMemberRolesByRoleId(role.id),
      `handleRoleDelete deleteMemberRolesByRoleId(${role.id})`,
      this.logger,
    );
    await withRetry(
      () => this.serversRepository.deleteRole(role.id),
      `handleRoleDelete deleteRole(${role.id})`,
      this.logger,
    );
    await this.permissionCache.invalidateServer(role.guild.id);
    await this.syncLogService.recordEventChange(
      role.guild.id,
      'role',
      role.id,
      'removed',
      `Role deleted: ${role.name}`,
    );
  }
}
