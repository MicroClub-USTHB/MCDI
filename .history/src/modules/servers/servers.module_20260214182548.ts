import { DiscordModule } from '@/discord/discord.module';
import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ServersListener } from './servers.listener';
import { ServersRepository } from '../servers/servers.repository';

@Module({
    imports: [DiscordModule],
    controllers: [ServersController],
    providers: [ServersRepository, ServersService, ServersListener],
})
export class ServersModule {}
