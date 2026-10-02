import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { ProjectsModule } from '../projects/projects.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksRepository } from './webhooks.repository';
import { ChannelAccessGuard } from '../channels/guards/channel-access.guard';
import { ProjectThrottlerGuard } from '../channels/guards/project-throttler.guard';

@Module({
  imports: [DiscordModule, ProjectsModule, AdminSettingsModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhooksRepository,
    ChannelAccessGuard,
    ProjectThrottlerGuard,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
