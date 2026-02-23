import { DiscordModule } from '@/discord/discord.module';
import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ServersListener } from './servers.listener';

@Module({
    imports: [DiscordModule],
    controllers: [ServersController],
    providers: [ServersService, ServersListener],
})
export class ServersModule {}
