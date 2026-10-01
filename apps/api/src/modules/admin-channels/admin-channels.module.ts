import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { AdminChannelsController } from './admin-channels.controller';

/**
 * Thin admin-session surface over the channels feature. Reuses the
 * `ChannelsService` exported by `ChannelsModule`; adds no providers of its own.
 */
@Module({
  imports: [ChannelsModule],
  controllers: [AdminChannelsController],
})
export class AdminChannelsModule {}
