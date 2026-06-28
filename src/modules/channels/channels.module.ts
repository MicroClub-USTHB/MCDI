import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { ProjectsModule } from '../projects/projects.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelAccessGuard } from './guards/channel-access.guard';

@Module({
  imports: [DiscordModule, ProjectsModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelAccessGuard],
  exports: [ChannelsService],
})
export class ChannelsModule {}
