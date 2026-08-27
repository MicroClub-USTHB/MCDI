import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { ProjectsModule } from '../projects/projects.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksRepository } from './webhooks.repository';
import { ChannelAccessGuard } from '../channels/guards/channel-access.guard';

@Module({
  imports: [DiscordModule, ProjectsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksRepository, ChannelAccessGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
