import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DiscordModule } from '../discord/discord.module';
import { MembersModule } from '../members/members.module';
import { ServersModule } from '../servers/servers.module';
import { SyncService } from './sync.service';
import { SyncListener } from './sync.listener';
import { SyncController } from './sync.controller';
import { SyncRepository } from './sync.repository';
import { SyncLogService } from './services/sync-log.service';
import { MemberSyncService } from './services/member-sync.service';
import { RoleSyncService } from './services/role-sync.service';
import { ServerSyncService } from './services/server-sync.service';

@Module({
  imports: [
    DatabaseModule,
    DiscordModule,
    forwardRef(() => MembersModule),
    forwardRef(() => ServersModule),
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncListener,
    SyncRepository,
    SyncLogService,
    MemberSyncService,
    RoleSyncService,
    ServerSyncService,
  ],
  exports: [SyncService],
})
export class SyncModule {}
