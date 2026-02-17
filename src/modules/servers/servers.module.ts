import { DiscordModule } from '@/modules/discord/discord.module';
import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ServersListener } from './servers.listener';
import { ServersRepository } from '../servers/servers.repository';
import { AdminMembersController } from './admin-members/admin-members.controller';
import { AdminMembersService } from './admin-members/admin-members.service';
import { AdminMembersRepository } from './admin-members/admin-members.repository';

@Module({
  imports: [DiscordModule],
  controllers: [ServersController, AdminMembersController],
  providers: [
    ServersRepository,
    ServersService,
    ServersListener,
    AdminMembersService,
    AdminMembersRepository,
  ],
})
export class ServersModule {}
