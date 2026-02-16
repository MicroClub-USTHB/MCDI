import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { ServersService } from './servers.service';
import { Guild } from 'discord.js';

@Injectable()
export class ServersListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServersListener.name);
  private boundHandler?: (guild: Guild) => void;

  constructor(
    private readonly discordService: DiscordService,
    private readonly serversService: ServersService,
  ) {}

  onModuleInit() {
    const client = this.discordService.getClient();

    this.boundHandler = async (guild: Guild) => {
      try {
        await this.serversService.registerServer({
          guildId: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          isActive: true,
        });
        this.logger.log(`Registered guild ${guild.name} (${guild.id})`);
      } catch (err) {
        this.logger.error(
          `Failed to register guild ${guild.id}`,
          (err as Error).stack,
        );
      }
    };

    client.on('guildCreate', this.boundHandler);
  }

  onModuleDestroy() {
    const client = this.discordService.getClient();
    if (this.boundHandler) {
      client.off('guildCreate', this.boundHandler);
    }
  }
}
