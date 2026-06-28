import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { ProjectsModule } from '../projects/projects.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelAccessGuard } from './guards/channel-access.guard';
import { ProjectThrottlerGuard } from './guards/project-throttler.guard';

@Module({
  imports: [DiscordModule, ProjectsModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelAccessGuard, ProjectThrottlerGuard],
  exports: [ChannelsService],
})
export class ChannelsModule {}
