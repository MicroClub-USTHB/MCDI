import { Inject, Injectable } from '@nestjs/common';
import { DISCORD_CLIENT } from './discord.constants';
import Discord from 'discord.js';

@Injectable()
export class DiscordService {
  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Discord.Client,
  ) {}
  getClient(): Discord.Client {
    return this.client;
  }
  getUserById(userId: string): Promise<Discord.User | null> {
    return this.client.users.fetch(userId).catch(() => null);
  }
  getGuildById(guildId: string): Promise<Discord.Guild | null> {
    return this.client.guilds.fetch(guildId).catch(() => null);
  }
}
