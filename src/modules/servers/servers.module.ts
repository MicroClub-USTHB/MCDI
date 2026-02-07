import { DiscordModule } from '@/discord/discord.module';
import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';

@Module({
    imports: [DiscordModule],
    controllers: [ServersController],
    providers: [ServersService],
})
export class ServersModule {}
