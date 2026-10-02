import { DiscordModule } from '@/modules/discord/discord.module';
import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ServersListener } from './servers.listener';
import { ServersRepository } from '../servers/servers.repository';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [DiscordModule, ProjectsModule],
  controllers: [ServersController],
  providers: [ServersRepository, ServersService, ServersListener],
  exports: [ServersRepository, ServersService],
})
export class ServersModule {}
