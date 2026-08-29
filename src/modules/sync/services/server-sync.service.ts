import { Injectable, Logger } from '@nestjs/common';
import { Guild } from 'discord.js';
import { ServersRepository } from '../../servers/servers.repository';
import { SyncRepository } from '../sync.repository';
import { SyncChangeEntry } from '../sync-types';
import { withRetry } from '../../../common/utils/retry.util';
import { SyncTarget } from '../dto/trigger-sync.dto';

@Injectable()
export class ServerSyncService {
  private readonly logger = new Logger(ServerSyncService.name);

  constructor(
    private readonly serversRepository: ServersRepository,
    private readonly syncRepository: SyncRepository,
  ) {}

  /**
   * Sync server name/icon into the DB as part of a full sync run.
   * Appends a change entry to the shared buffer.
   */
  async syncServerInfo(
    serverId: string,
    guild: Guild,
    syncStart: Date,
    syncId: number,
    changeBuffer: SyncChangeEntry[],
  ): Promise<void> {
    await withRetry(
      () =>
        this.serversRepository.updateById(serverId, {
          name: guild.name,
          icon: guild.iconURL(),
          syncedAt: syncStart,
          updatedAt: new Date(),
        }),
      `updateServerInfo(${serverId})`,
      this.logger,
    );
    changeBuffer.push({
      syncLogId: syncId,
      serverId,
      entityType: 'server',
      entityId: serverId,
      action: 'updated',
      description: `Server info synced: ${guild.name}`,
    });
  }

  /**
   * Register a newly-joined guild and create a sync log entry.
   * Returns whether a new queued sync should be kicked off and the log ID.
   */
  async prepareGuildCreate(
    guild: Guild,
  ): Promise<{ shouldSync: boolean; logId?: number }> {
    this.logger.log(`Bot joined server: ${guild.id} (${guild.name})`);
    await this.serversRepository.upsertServer({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      isMain: false,
      isActive: true,
      type: 'other',
    });

    const activeLog = await this.syncRepository.getActiveLog(guild.id);
    if (activeLog) return { shouldSync: false };

    const log = await this.syncRepository.createLog(
      guild.id,
      'full',
      'queued',
      new Date(),
      SyncTarget.ALL,
    );
    return { shouldSync: true, logId: log.id };
  }

  async handleGuildDelete(guild: Guild): Promise<void> {
    this.logger.log(`Bot removed from server: ${guild.id} (${guild.name})`);
    await this.serversRepository.updateById(guild.id, {
      isActive: false,
      disabledReason: 'Bot removed from server',
      updatedAt: new Date(),
    });
  }

  async handleGuildUpdate(_oldGuild: Guild, newGuild: Guild): Promise<void> {
    this.logger.debug(`Guild updated: ${newGuild.id} (${newGuild.name})`);
    await withRetry(
      () =>
        this.serversRepository.updateById(newGuild.id, {
          name: newGuild.name,
          icon: newGuild.iconURL(),
          updatedAt: new Date(),
        }),
      `handleGuildUpdate updateById(${newGuild.id})`,
      this.logger,
    );
  }
}
