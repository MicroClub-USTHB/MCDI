/* eslint-disable @typescript-eslint/only-throw-error */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { MemberRepository } from '../members/member.repository';
import { ServersRepository } from '../servers/servers.repository';
import { SyncRepository } from './sync.repository';
import { Guild, GuildMember, User, Role } from 'discord.js';
import { members } from '../../database/entities/member.entity';
import { SyncStatusDto } from './dto/sync-status.dto';
import { SyncLogDto, SyncLogsResponseDto } from './dto/sync-log.dto';
import { SyncTarget } from './dto/trigger-sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(
    private readonly discordService: DiscordService,
    private readonly memberRepository: MemberRepository,
    private readonly serversRepository: ServersRepository,
    private readonly syncRepository: SyncRepository,
  ) { }

  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Retry ${attempt}/${this.MAX_RETRIES} for ${context} failed: ${lastError.message}`,
        );
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async triggerFullSync(serverId: string, target: SyncTarget = SyncTarget.ALL): Promise<{ syncId: number }> {
    const server = await this.serversRepository.findById(serverId);
    if (!server) {
      throw new NotFoundException('Server not found');
    }

    const inProgress = await this.syncRepository.getInProgressLog(serverId);
    if (inProgress) {
      throw new ConflictException(
        'A sync is already in progress for this server',
      );
    }

    const startedAt = new Date();
    const log = await this.syncRepository.createLog(
      serverId,
      'manual',
      'in_progress',
      startedAt,
    );

    this.runFullSync(serverId, log.id, target).catch((err: unknown) => {
      const errorStack = err instanceof Error ? err.stack : String(err);
      this.logger.error(
        `Background sync failed for server ${serverId}`,
        errorStack,
      );
    });

    return { syncId: log.id };
  }

  async triggerMultipleSyncs(
    serverIds: string[],
    target: SyncTarget = SyncTarget.ALL,
  ): Promise<{ results: { serverId: string; syncId?: number; error?: string }[] }> {
    const results: { serverId: string; syncId?: number; error?: string }[] = [];
    let targetsToSync = serverIds;

    if (!targetsToSync || targetsToSync.length === 0) {
      const activeServers = await this.serversRepository.findAllActive();
      targetsToSync = activeServers.map((s) => s.id);
      this.logger.log(`No serverIds provided. Scheduled sync for all ${targetsToSync.length} active servers.`);
    }

    for (const serverId of targetsToSync) {
      try {
        const result = await this.triggerFullSync(serverId, target);
        results.push({ serverId, syncId: result.syncId });
      } catch (err: unknown) {
        results.push({
          serverId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { results };
  }

  private async runFullSync(serverId: string, syncId: number, target: SyncTarget = SyncTarget.ALL): Promise<void> {
    const guild = await this.discordService.getGuildById(serverId);
    if (!guild) {
      await this.syncRepository.updateLog(syncId, {
        status: 'failed',
        message: 'Guild not found or bot not in server',
        finishedAt: new Date(),
      });
      return;
    }

    const syncStart = new Date();
    let membersSynced = 0;
    let rolesSynced = 0;

    try {
      // Update server basic information
      await this.withRetry(
        () =>
          this.serversRepository.updateById(serverId, {
            name: guild.name,
            icon: guild.iconURL(),
            syncedAt: syncStart,
            updatedAt: new Date(),
          }),
        `updateServerInfo(${serverId})`,
      );

      // Sync all roles
      if (target === SyncTarget.ALL || target === SyncTarget.ROLES) {
        this.logger.debug(`Fetching all roles for guild ${serverId}`);
        const guildRoles = await guild.roles.fetch();
        for (const [, role] of guildRoles) {
          await this.withRetry(
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
              }),
            `upsertRole(${role.id})`,
          );
          await this.withRetry(
            () => this.serversRepository.syncRolePermissions(role.id, role.permissions.bitfield),
            `syncRolePermissions(${role.id})`,
          );
        }
        this.logger.log(
          `Upserted ${guildRoles.size} roles for server ${serverId}`,
        );
      }

      // Sync members
      let deactivatedCount = 0;
      if (target === SyncTarget.ALL || target === SyncTarget.MEMBERS) {
        let lastId: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const fetchOptions: { limit: number; after?: string } = { limit: 1000 };
          if (lastId) {
            fetchOptions.after = lastId;
          }

          const fetched = await guild.members.fetch(fetchOptions);
          if (fetched.size === 0) break;

          for (const [, guildMember] of fetched) {
            await this.processMember(guild, guildMember, syncStart);
            membersSynced++;
            rolesSynced += guildMember.roles.cache.size;
          }

          lastId = fetched.last()?.id;
          hasMore = fetched.size === 1000;
        }

        // Mark inactive members
        deactivatedCount =
          await this.memberRepository.markInactiveForServer(serverId, syncStart);
        this.logger.log(
          `Deactivated ${deactivatedCount} members in server ${serverId}`,
        );
      }

      await this.syncRepository.updateLog(syncId, {
        status: 'success',
        membersSynced,
        rolesSynced,
        finishedAt: new Date(),
        message: `Sync completed. ${deactivatedCount} members marked inactive.`,
      });
    } catch (error: unknown) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Full sync failed for server ${serverId}`, errorStack);
      await this.syncRepository.updateLog(syncId, {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        finishedAt: new Date(),
      });
    }
  }

  async processMember(
    guild: Guild,
    guildMember: GuildMember,
    syncTime: Date,
  ): Promise<void> {
    // Upsert member
    const memberData: typeof members.$inferInsert = {
      id: guildMember.id,
      username: guildMember.user.username,
      globalName: guildMember.user.globalName ?? null,
      displayName: guildMember.nickname ?? null,
      avatar: guildMember.user.avatarURL(),
      email: null,
      isClubMember: false,
      joinedAt: guildMember.joinedAt ?? null,
      syncedAt: syncTime,
    };
    await this.withRetry(
      () => this.memberRepository.upsertMember(memberData),
      `upsertMember(${guildMember.id})`,
    );

    // Upsert server membership
    await this.withRetry(
      () =>
        this.memberRepository.upsertServerMembership({
          serverId: guild.id,
          memberId: guildMember.id,
          joinedAt: guildMember.joinedAt ?? null,
          isActive: true,
          lastSyncedAt: syncTime,
        }),
      `upsertServerMembership(${guildMember.id})`,
    );

    // Replace roles
    const roleIds = [...guildMember.roles.cache.keys()];
    await this.withRetry(
      () =>
        this.memberRepository.replaceMemberRoles(
          guild.id,
          guildMember.id,
          roleIds,
        ),
      `replaceMemberRoles(${guildMember.id})`,
    );
  }

  //Event Handlers
  async handleMemberAdd(guildMember: GuildMember): Promise<void> {
    this.logger.debug(
      `Member added: ${guildMember.id} in ${guildMember.guild.id}`,
    );
    await this.processMember(guildMember.guild, guildMember, new Date());
  }

  async handleMemberRemove(guildMember: GuildMember): Promise<void> {
    this.logger.debug(
      `Member removed: ${guildMember.id} in ${guildMember.guild.id}`,
    );
    await this.withRetry(
      () =>
        this.memberRepository.upsertServerMembership({
          serverId: guildMember.guild.id,
          memberId: guildMember.id,
          joinedAt: guildMember.joinedAt ?? null,
          isActive: false,
          lastSyncedAt: new Date(),
        }),
      `handleMemberRemove upsertServerMembership(${guildMember.id})`,
    );
  }

  async handleMemberUpdate(
    oldMember: GuildMember,
    newMember: GuildMember,
  ): Promise<void> {
    this.logger.debug(
      `Member updated: ${newMember.id} in ${newMember.guild.id}`,
    );

    const syncTime = new Date();

    // Update member profile
    if (
      oldMember.user.username !== newMember.user.username ||
      oldMember.user.globalName !== newMember.user.globalName ||
      oldMember.user.avatar !== newMember.user.avatar ||
      oldMember.nickname !== newMember.nickname
    ) {
      await this.withRetry(
        () =>
          this.memberRepository.upsertMember({
            id: newMember.id,
            username: newMember.user.username,
            globalName: newMember.user.globalName ?? null,
            displayName: newMember.nickname ?? null,
            avatar: newMember.user.avatarURL(),
            email: null,
            isClubMember: false,
            joinedAt: newMember.joinedAt ?? null,
            syncedAt: syncTime,
          }),
        `handleMemberUpdate upsertMember(${newMember.id})`,
      );
    }

    // Update roles
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    if (
      oldRoles.size !== newRoles.size ||
      !oldRoles.every((role) => newRoles.has(role.id))
    ) {
      await this.withRetry(
        () =>
          this.memberRepository.replaceMemberRoles(
            newMember.guild.id,
            newMember.id,
            [...newRoles.keys()],
          ),
        `handleMemberUpdate replaceMemberRoles(${newMember.id})`,
      );
    }

    // Update membership
    await this.withRetry(
      () =>
        this.memberRepository.upsertServerMembership({
          serverId: newMember.guild.id,
          memberId: newMember.id,
          joinedAt: newMember.joinedAt ?? null,
          isActive: true,
          lastSyncedAt: syncTime,
        }),
      `handleMemberUpdate upsertServerMembership(${newMember.id})`,
    );
  }

  async handleUserUpdate(oldUser: User, newUser: User): Promise<void> {
    this.logger.debug(`User updated: ${newUser.id}`);

    await this.withRetry(
      () =>
        this.memberRepository.upsertMember({
          id: newUser.id,
          username: newUser.username,
          globalName: newUser.globalName ?? null,
          displayName: null,
          avatar: newUser.avatarURL(),
          email: null,
          isClubMember: false,
          joinedAt: null,
          syncedAt: new Date(),
        }),
      `handleUserUpdate upsertMember(${newUser.id})`,
    );
  }

  // Role Event Handlers
  async handleRoleCreate(role: Role): Promise<void> {
    this.logger.debug(`Role created: ${role.id} in ${role.guild.id}`);
    await this.withRetry(
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
        }),
      `handleRoleCreate upsertRole(${role.id})`,
    );
    await this.withRetry(
      () => this.serversRepository.syncRolePermissions(role.id, role.permissions.bitfield),
      `handleRoleCreate syncRolePermissions(${role.id})`,
    );
  }

  async handleRoleUpdate(role: Role): Promise<void> {
    this.logger.debug(`Role updated: ${role.id} in ${role.guild.id}`);
    await this.withRetry(
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
        }),
      `handleRoleUpdate upsertRole(${role.id})`,
    );
    await this.withRetry(
      () => this.serversRepository.syncRolePermissions(role.id, role.permissions.bitfield),
      `handleRoleUpdate syncRolePermissions(${role.id})`,
    );
  }

  async handleRoleDelete(role: Role): Promise<void> {
    this.logger.debug(`Role deleted: ${role.id} from ${role.guild.id}`);
    await this.withRetry(
      () => this.memberRepository.deleteMemberRolesByRoleId(role.id),
      `handleRoleDelete deleteMemberRolesByRoleId(${role.id})`,
    );
    await this.withRetry(
      () => this.serversRepository.deleteRole(role.id),
      `handleRoleDelete deleteRole(${role.id})`,
    );
  }

  async getSyncStatus(serverId: string): Promise<SyncStatusDto | null> {
    const log = await this.syncRepository.getLatestLog(serverId);
    if (!log) return null;

    return {
      serverId: log.serverId,
      lastSyncAt: log.finishedAt?.toISOString() ?? null,
      status: log.status,
      membersSynced: log.membersSynced,
      rolesSynced: log.rolesSynced,
      message: log.message ?? undefined,
      startedAt: log.startedAt.toISOString(),
      finishedAt: log.finishedAt?.toISOString(),
    };
  }

  // ─── Startup Sync ─────────────────────────────────────────

  /**
   * Called once on bot ready — triggers a full sync for every active server
   * the bot is currently in. Errors on one server never block others.
   */
  async startupSyncAll(): Promise<void> {
    const activeServers = await this.serversRepository.findAllActive();
    this.logger.log(
      `Bot ready — starting boot sync for ${activeServers.length} active server(s)`,
    );

    for (const server of activeServers) {
      try {
        const guild = await this.discordService.getGuildById(server.id);
        if (!guild) {
          this.logger.warn(
            `Bot not in server ${server.id} (${server.name}) — skipping boot sync`,
          );
          continue;
        }

        const inProgress = await this.syncRepository.getInProgressLog(server.id);
        if (inProgress) {
          this.logger.log(
            `Skipping boot sync for ${server.id} — sync already in progress`,
          );
          continue;
        }

        const log = await this.syncRepository.createLog(
          server.id,
          'full',
          'in_progress',
          new Date(),
        );
        this.runFullSync(server.id, log.id).catch((err: unknown) => {
          this.logger.error(
            `Boot sync failed for server ${server.id}`,
            err instanceof Error ? err.stack : String(err),
          );
        });
      } catch (err: unknown) {
        this.logger.error(
          `Error scheduling boot sync for server ${server.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  // ─── Bot Guild Events ──────────────────────────────────────

  /**
   * Bot was added to a new server — register it and kick off a full sync.
   */
  async handleGuildCreate(guild: Guild): Promise<void> {
    this.logger.log(`Bot joined server: ${guild.id} (${guild.name})`);

    await this.serversRepository.upsertServer({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      isMain: false,
      isActive: true,
      type: 'other',
    });

    const inProgress = await this.syncRepository.getInProgressLog(guild.id);
    if (inProgress) return;

    const log = await this.syncRepository.createLog(
      guild.id,
      'full',
      'in_progress',
      new Date(),
    );
    this.runFullSync(guild.id, log.id).catch((err: unknown) => {
      this.logger.error(
        `guildCreate sync failed for ${guild.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    });
  }

  /**
   * Bot was removed from a server — mark it as inactive in the DB.
   */
  async handleGuildDelete(guild: Guild): Promise<void> {
    this.logger.log(`Bot removed from server: ${guild.id} (${guild.name})`);
    await this.serversRepository.updateById(guild.id, {
      isActive: false,
      disabledReason: 'Bot removed from server',
      updatedAt: new Date(),
    });
  }

  /**
   * Server information was updated in Discord.
   */
  async handleGuildUpdate(oldGuild: Guild, newGuild: Guild): Promise<void> {
    this.logger.debug(`Guild updated: ${newGuild.id} (${newGuild.name})`);
    await this.withRetry(
      () =>
        this.serversRepository.updateById(newGuild.id, {
          name: newGuild.name,
          icon: newGuild.iconURL(),
          updatedAt: new Date(),
        }),
      `handleGuildUpdate updateById(${newGuild.id})`,
    );
  }

  // ─── Sync Logs ────────────────────────────────────────────

  async getSyncLogs(
    serverId: string,
    limit = 20,
    offset = 0,
  ): Promise<SyncLogsResponseDto> {
    const [logs, total] = await Promise.all([
      this.syncRepository.getLogs(serverId, limit, offset),
      this.syncRepository.countLogs(serverId),
    ]);

    return {
      total,
      logs: logs.map(
        (log): SyncLogDto => ({
          id: log.id,
          serverId: log.serverId,
          syncType: log.syncType,
          status: log.status,
          membersSynced: log.membersSynced,
          rolesSynced: log.rolesSynced,
          message: log.message ?? undefined,
          startedAt: log.startedAt.toISOString(),
          finishedAt: log.finishedAt?.toISOString(),
        }),
      ),
    };
  }

  // ─── All-Servers Status ───────────────────────────────────

  async getAllServersSyncStatus(): Promise<SyncStatusDto[]> {
    const activeServers = await this.serversRepository.findAllActive();

    const statuses = await Promise.all(
      activeServers.map(async (server): Promise<SyncStatusDto> => {
        const log = await this.syncRepository.getLatestLog(server.id);
        return {
          serverId: server.id,
          lastSyncAt: log?.finishedAt?.toISOString() ?? null,
          status: log?.status ?? 'never',
          membersSynced: log?.membersSynced ?? 0,
          rolesSynced: log?.rolesSynced ?? 0,
          message: log?.message ?? undefined,
          startedAt: log?.startedAt?.toISOString() ?? '',
          finishedAt: log?.finishedAt?.toISOString(),
        };
      }),
    );

    return statuses;
  }
}
