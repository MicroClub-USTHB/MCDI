import {
  Inject,
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
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildPresences,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildWebhooks,

        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
      ],
    });

    const TOKEN = configService.get<string>('discord.token');

    await client.login(TOKEN);

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
  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Discord.Client,
  ) {}

  onModuleInit() {
    console.log('DiscordModule initialized');
    console.log('Discord client logged in as:', this.client.user?.tag);
  }

  async onModuleDestroy() {
    console.log('Destroying Discord client');
    await this.client.destroy();
  }
}
