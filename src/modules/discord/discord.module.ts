import {
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordService } from './discord.service';
import Discord from 'discord.js';
import { DISCORD_CLIENT } from './discord.constants';

const DiscordProvider: Provider = {
  provide: DISCORD_CLIENT,
  useFactory: () =>
    new Discord.Client({
      intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildPresences,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildWebhooks,

        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
      ],
    }),
};

@Module({
  imports: [ConfigModule],
  providers: [DiscordService, DiscordProvider],
  exports: [DISCORD_CLIENT, DiscordService],
})
export class DiscordModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordModule.name);

  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Skipping Discord bot connection in test environment');
      return;
    }

    this.logger.log('DiscordModule initialized');
    this.discordService.onBotReady(() => {
      this.logger.log(
        `Discord client logged in as: ${this.discordService.getClient().user?.tag}`,
      );
    });
    this.discordService.startBotConnection();
  }

  async onModuleDestroy() {
    this.logger.log('Destroying Discord client');
    await this.discordService.destroyBotConnection();
  }
}
