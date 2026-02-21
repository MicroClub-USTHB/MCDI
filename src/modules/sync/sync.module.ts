import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DiscordModule } from '../discord/discord.module';
import { MembersModule } from '../members/members.module';
import { ServersModule } from '../servers/servers.module';
import { SyncService } from './sync.service';
import { SyncListener } from './sync.listener';
import { SyncController } from './sync.controller';
import { SyncRepository } from './sync.repository';

@Module({
  imports: [
    DatabaseModule,
    DiscordModule,
    forwardRef(() => MembersModule),
    forwardRef(() => ServersModule),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncListener, SyncRepository],
  exports: [SyncService],
})
export class SyncModule {}
