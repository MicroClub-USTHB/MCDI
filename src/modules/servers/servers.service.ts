import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as schema from '../../database/entities';
import { servers, serverSyncLogs } from '../../database/entities';
import { and, eq, sql } from 'drizzle-orm';
import { DiscordService } from '../../discord/discord.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import * as databaseModule from '../../database/database.module';
@Injectable()
export class ServersService {

constructor(
  @Inject(databaseModule.DRIZZLE) private readonly db: databaseModule.DrizzleDB,
  private readonly discordService: DiscordService,
) {}


  async registerServer(dto: CreateServerDto) {
    const now = new Date();
    const guild = await this.discordService.getGuildById(dto.guildId);

    const name = dto.name ?? guild?.name ?? 'Unknown';
    const icon = dto.icon ?? guild?.iconURL() ?? null;

    return this.db.transaction(async (tx) => {
      if (dto.isMain) {
        await tx
          .update(servers)
          .set({ isMain: false, updatedAt: now })
          .where(eq(servers.isMain, true));
      }

      const [row] = await tx
        .insert(servers)
        .values({
          id: dto.guildId,
          name,
          icon,
          type: dto.type ?? 'other',
          isMain: dto.isMain ?? false,
          isActive: dto.isActive ?? true,
          syncFrequencyMinutes: dto.syncFrequencyMinutes ?? 60,
          defaultPermissionPolicy: dto.defaultPermissionPolicy ?? 'denyAll',
          disabledReason: dto.disabledReason ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: servers.id,
          set: {
            name,
            icon,
            type: dto.type ?? 'other',
            isMain: dto.isMain ?? false,
            isActive: dto.isActive ?? true,
            syncFrequencyMinutes: dto.syncFrequencyMinutes ?? 60,
            defaultPermissionPolicy: dto.defaultPermissionPolicy ?? 'denyAll',
            disabledReason: dto.disabledReason ?? null,
            updatedAt: now,
          },
        })
        .returning();

      return row;
    });
  }

  async listServers() {
    const lastSyncSub = this.db
      .select({
        serverId: serverSyncLogs.serverId,
        lastSyncAt: sql`max(${serverSyncLogs.finishedAt})`.as('last_sync_at'),
      })
      .from(serverSyncLogs)
      .groupBy(serverSyncLogs.serverId)
      .as('last_sync');

    const rows = await this.db
      .select({
        id: servers.id,
        name: servers.name,
        icon: servers.icon,
        type: servers.type,
        isMain: servers.isMain,
        isActive: servers.isActive,
        syncFrequencyMinutes: servers.syncFrequencyMinutes,
        defaultPermissionPolicy: servers.defaultPermissionPolicy,
        disabledReason: servers.disabledReason,
        syncedAt: servers.syncedAt,
        lastSyncAt: lastSyncSub.lastSyncAt,
      })
      .from(servers)
      .leftJoin(lastSyncSub, eq(servers.id, lastSyncSub.serverId));

    const client = this.discordService.getClient();
    const clientReady = client.isReady();

    return rows.map((row) => ({
      ...row,
      botConnected: clientReady && client.guilds.cache.has(row.id),
    }));
  }

  async updateServer(serverId: string, dto: UpdateServerDto) {
    const now = new Date();
    const patch: Partial<typeof servers.$inferInsert> = {
      updatedAt: now,
    };

    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.syncFrequencyMinutes !== undefined)
      patch.syncFrequencyMinutes = dto.syncFrequencyMinutes;
    if (dto.defaultPermissionPolicy !== undefined)
      patch.defaultPermissionPolicy = dto.defaultPermissionPolicy;
    if (dto.disabledReason !== undefined)
      patch.disabledReason = dto.disabledReason;

    return this.db.transaction(async (tx) => {
      if (dto.isMain) {
        await tx
          .update(servers)
          .set({ isMain: false, updatedAt: now })
          .where(eq(servers.isMain, true));
        patch.isMain = true;
      } else if (dto.isMain === false) {
        patch.isMain = false;
      }

      const [row] = await tx
        .update(servers)
        .set(patch)
        .where(eq(servers.id, serverId))
        .returning();

      if (!row) throw new NotFoundException('Server not found');
      return row;
    });
  }
}
