import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Guild, GuildMember, User, Role } from 'discord.js';
import { DiscordService } from '../discord/discord.service';
import { ServersRepository } from '../servers/servers.repository';
import { SyncRepository } from './sync.repository';
import { MemberSyncService } from './services/member-sync.service';
import { RoleSyncService } from './services/role-sync.service';
import { ServerSyncService } from './services/server-sync.service';
import { SyncLogService } from './services/sync-log.service';
import { SyncChangeEntry } from './sync-types';
import { SyncTarget } from './dto/trigger-sync.dto';
import { SyncStatusDto } from './dto/sync-status.dto';
import { SyncLogsResponseDto } from './dto/sync-log.dto';
import { SyncChangeDetailsResponseDto } from './dto/sync-change-detail.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly serversRepository: ServersRepository,
    private readonly syncRepository: SyncRepository,
    private readonly memberSyncService: MemberSyncService,
    private readonly roleSyncService: RoleSyncService,
    private readonly serverSyncService: ServerSyncService,
    private readonly syncLogService: SyncLogService,
  ) {}

  // ── Bulk sync orchestration ──────────────────────────────────────────

  async triggerFullSync(
    serverId: string,
    target: SyncTarget = SyncTarget.ALL,
  ): Promise<{ syncId: number }> {
    const server = await this.serversRepository.findById(serverId);
    if (!server) throw new NotFoundException('Server not found');

    const inProgress = await this.syncRepository.getInProgressLog(serverId);
    if (inProgress) {
      throw new ConflictException('A sync is already in progress for this server');
    }

    const log = await this.syncRepository.createLog(serverId, 'manual', 'in_progress', new Date());
    this.runFullSync(serverId, log.id, target).catch((err: unknown) => {
      this.logger.error(
        `Background sync failed for server ${serverId}`,
        err instanceof Error ? err.stack : String(err),
      );
    });
    return { syncId: log.id };
  }

  async triggerMultipleSyncs(
    serverIds: string[],
    target: SyncTarget = SyncTarget.ALL,
  ): Promise<{ results: { serverId: string; syncId?: number; error?: string }[] }> {
    let targetsToSync = serverIds;
    if (!targetsToSync || targetsToSync.length === 0) {
      const activeServers = await this.serversRepository.findAllActive();
      targetsToSync = activeServers.map((s) => s.id);
      this.logger.log(
        `No serverIds provided. Scheduled sync for all ${targetsToSync.length} active servers.`,
      );
    }
    const results: { serverId: string; syncId?: number; error?: string }[] = [];
    for (const id of targetsToSync) {
      try {
        const result = await this.triggerFullSync(id, target);
        results.push({ serverId: id, syncId: result.syncId });
      } catch (err: unknown) {
        results.push({ serverId: id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { results };
  }

  private async runFullSync(
    serverId: string,
    syncId: number,
    target: SyncTarget = SyncTarget.ALL,
  ): Promise<void> {
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
    const changeBuffer: SyncChangeEntry[] = [];
    let membersSynced = 0;
    let rolesSynced = 0;
    let deactivatedCount = 0;

    try {
      await this.serverSyncService.syncServerInfo(serverId, guild, syncStart, syncId, changeBuffer);

      if (target === SyncTarget.ALL || target === SyncTarget.ROLES) {
        const r = await this.roleSyncService.syncAllRoles(guild, syncId, changeBuffer);
        rolesSynced += r.rolesSynced;
      }

      if (target === SyncTarget.ALL || target === SyncTarget.MEMBERS) {
        const m = await this.memberSyncService.syncAllMembers(guild, syncId, syncStart, changeBuffer);
        membersSynced += m.membersSynced;
        rolesSynced += m.rolesSynced;
        deactivatedCount = m.deactivatedCount;
      }

      await this.syncLogService.flushChangeBuffer(changeBuffer);
      await this.syncRepository.updateLog(syncId, {
        status: 'success',
        membersSynced,
        rolesSynced,
        finishedAt: new Date(),
        message: `Sync completed. ${deactivatedCount} members marked inactive.`,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Full sync failed for server ${serverId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.syncLogService.flushChangeBuffer(changeBuffer).catch(() => { /* best-effort */ });
      await this.syncRepository.updateLog(syncId, {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        finishedAt: new Date(),
      });
    }
  }

  // ── Startup sync ─────────────────────────────────────────────────────

  async startupSyncAll(): Promise<void> {
    const activeServers = await this.serversRepository.findAllActive();
    this.logger.log(
      `Bot ready — starting boot sync for ${activeServers.length} active server(s)`,
    );
    for (const server of activeServers) {
      try {
        const guild = await this.discordService.getGuildById(server.id);
        if (!guild) {
          this.logger.warn(`Bot not in server ${server.id} (${server.name}) — skipping boot sync`);
          continue;
        }
        const inProgress = await this.syncRepository.getInProgressLog(server.id);
        if (inProgress) {
          this.logger.log(`Skipping boot sync for ${server.id} — sync already in progress`);
          continue;
        }
        const log = await this.syncRepository.createLog(server.id, 'full', 'in_progress', new Date());
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

  // ── Delegate: Member events ──────────────────────────────────────────

  async processMember(guild: Guild, guildMember: GuildMember, syncTime: Date): Promise<void> {
    return this.memberSyncService.processMember(guild, guildMember, syncTime);
  }

  async handleMemberAdd(guildMember: GuildMember): Promise<void> {
    return this.memberSyncService.handleMemberAdd(guildMember);
  }

  async handleMemberRemove(guildMember: GuildMember): Promise<void> {
    return this.memberSyncService.handleMemberRemove(guildMember);
  }

  async handleMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    return this.memberSyncService.handleMemberUpdate(oldMember, newMember);
  }

  async handleUserUpdate(oldUser: User, newUser: User): Promise<void> {
    return this.memberSyncService.handleUserUpdate(oldUser, newUser);
  }

  // ── Delegate: Role events ────────────────────────────────────────────

  async handleRoleCreate(role: Role): Promise<void> {
    return this.roleSyncService.handleRoleCreate(role);
  }

  async handleRoleUpdate(role: Role): Promise<void> {
    return this.roleSyncService.handleRoleUpdate(role);
  }

  async handleRoleDelete(role: Role): Promise<void> {
    return this.roleSyncService.handleRoleDelete(role);
  }

  // ── Delegate: Guild events ────────────────────────────────────────────

  async handleGuildCreate(guild: Guild): Promise<void> {
    const { shouldSync, logId } = await this.serverSyncService.prepareGuildCreate(guild);
    if (shouldSync && logId !== undefined) {
      this.runFullSync(guild.id, logId).catch((err: unknown) => {
        this.logger.error(
          `guildCreate sync failed for ${guild.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }
  }

  async handleGuildDelete(guild: Guild): Promise<void> {
    return this.serverSyncService.handleGuildDelete(guild);
  }

  async handleGuildUpdate(oldGuild: Guild, newGuild: Guild): Promise<void> {
    return this.serverSyncService.handleGuildUpdate(oldGuild, newGuild);
  }

  // ── Delegate: Query / status ─────────────────────────────────────────

  async getSyncStatus(serverId: string): Promise<SyncStatusDto | null> {
    return this.syncLogService.getSyncStatus(serverId);
  }

  async getAllServersSyncStatus(): Promise<SyncStatusDto[]> {
    return this.syncLogService.getAllServersSyncStatus();
  }

  async getSyncLogs(
    serverId: string,
    limit = 20,
    offset = 0,
  ): Promise<SyncLogsResponseDto> {
    return this.syncLogService.getSyncLogs(serverId, limit, offset);
  }

  async getSyncChangeDetails(
    syncLogId: number,
    limit = 100,
    offset = 0,
  ): Promise<SyncChangeDetailsResponseDto> {
    return this.syncLogService.getSyncChangeDetails(syncLogId, limit, offset);
  }
}
