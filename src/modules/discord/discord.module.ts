import {
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordService } from './discord.service';
import Discord from 'discord.js';
import { DISCORD_CLIENT } from './discord.constants';

const DiscordProvider: Provider = {
  provide: DISCORD_CLIENT,
  useFactory: async (configService: ConfigService) => {
    const client = new Discord.Client({
      intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_PRESENCES,
        Discord.Intents.FLAGS.GUILD_INVITES,
        Discord.Intents.FLAGS.GUILD_VOICE_STATES,
        Discord.Intents.FLAGS.GUILD_WEBHOOKS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
      ],
    });

    const TOKEN = configService.get<string>('discord.token');

    try {
      await client.login(TOKEN);
    } catch (error) {
      new Logger('DiscordModule').warn(
        `Discord bot login failed - bot features will be unavailable. OAuth flow still works. ${(error as Error).message}`,
      );
    }

    return client;
  },
  inject: [ConfigService],
};

@Module({
  imports: [ConfigModule],
  providers: [DiscordService, DiscordProvider],
  exports: [DISCORD_CLIENT, DiscordService],
})
export class DiscordModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordModule.name);

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Discord.Client,
  ) {}

  onModuleInit() {
    this.logger.log('DiscordModule initialized');
    this.logger.log(`Discord client logged in as: ${this.client.user?.tag}`);
  }

  async onModuleDestroy() {
    this.logger.log('Destroying Discord client');
    try {
      await this.client.destroy();
    } catch {
      // ignore errors on shutdown
    }
  }
}
