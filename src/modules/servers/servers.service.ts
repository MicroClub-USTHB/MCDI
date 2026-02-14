import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { ServersRepository } from './servers.repository';
import { DisableServerDto } from './dto/disable-server.dto';

@Injectable()
export class ServersService {
  private readonly DEFAULTS = {
    name: 'Unknown',
    type: 'other',
    isMain: false,
    isActive: true,
    syncFrequencyHours: 1,
    defaultPermissionPolicy: 'deny_all' as const,
  };

  constructor(
    private readonly serversRepository: ServersRepository,
    private readonly discordService: DiscordService,
  ) {}

  async registerServer(dto: CreateServerDto) {
    try {

    const now = new Date();
    const guild = await this.discordService.getGuildById(dto.guildId);

    const serverData = {
      id: dto.guildId,
      name: dto.name || guild?.name || this.DEFAULTS.name,
      icon: dto.icon ?? guild?.iconURL() ?? null,
      type: dto.type || this.DEFAULTS.type,
      isMain: dto.isMain ?? this.DEFAULTS.isMain,
      isActive: dto.isActive ?? this.DEFAULTS.isActive,
      syncFrequencyHours:
        dto.syncFrequencyHours ?? this.DEFAULTS.syncFrequencyHours,
      defaultPermissionPolicy:
        dto.defaultPermissionPolicy || this.DEFAULTS.defaultPermissionPolicy,
      disabledReason: dto.disabledReason ?? null,
      updatedAt: now,
    };

    if (dto.isMain) {
      await this.serversRepository.clearMainServer(now);
    }

    return this.serversRepository.upsertServer(serverData);
    } catch (error) {
    this.logger.error(
      `registerServer failed for guildId=${dto.guildId}`,
      error instanceof Error ? error.stack : String(error),
    );
    throw new InternalServerErrorException('Failed to register server');
  }
  }

  async listServers() {
    const rows = await this.serversRepository.listServersWithLastSync();

    const client = this.discordService.getClient();
    const clientReady = client.isReady();

    return rows.map((row) => ({
      ...row,
      botConnected: clientReady && client.guilds.cache.has(row.id),
    }));
  }

  async updateServer(serverId: string, dto: UpdateServerDto) {
    const now = new Date();
    const patch: Record<string, unknown> = { updatedAt: now };

    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.syncFrequencyHours !== undefined) {
      patch.syncFrequencyHours = dto.syncFrequencyHours;
    }
    if (dto.defaultPermissionPolicy !== undefined) {
      patch.defaultPermissionPolicy = dto.defaultPermissionPolicy;
    }

    if (dto.isMain) {
      await this.serversRepository.clearMainServer(now);
      patch.isMain = true;
    } else if (dto.isMain === false) {
      patch.isMain = false;
    }

    const row = await this.serversRepository.updateById(serverId, patch);
    if (!row) throw new NotFoundException('Server not found');
    return row;
  }

  async getServerById(serverId: string) {
    const row = await this.serversRepository.findById(serverId);
    if (!row) throw new NotFoundException('Server not found');
    return row;
  }

  async deleteServer(serverId: string) {
    const existing = await this.serversRepository.findById(serverId);
    if (!existing) throw new NotFoundException('Server not found');

    await this.serversRepository.deleteServerCascade(serverId);
    return { message: 'Server deleted successfully', serverId };
  }

  async disableServer(serverId: string, dto: DisableServerDto) {
  const row = await this.serversRepository.updateById(serverId, {
    isActive: false,
    disabledReason: dto.disabledReason ?? null,
    updatedAt: new Date(),
  });

  if (!row) throw new NotFoundException('Server not found');
  return row;
}

  async enableServer(serverId: string) {
    const row = await this.serversRepository.updateById(serverId, {
      isActive: true,
      disabledReason: null,
      updatedAt: new Date(),
    });

    if (!row) throw new NotFoundException('Server not found');
      return row;
    }

  private readonly logger = new Logger(ServersService.name);

}
