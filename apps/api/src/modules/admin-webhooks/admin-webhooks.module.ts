import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AdminWebhooksController } from './admin-webhooks.controller';

/**
 * Thin admin-session surface over the webhooks feature. Reuses the
 * `WebhooksService` exported by `WebhooksModule`; adds no providers of its own.
 */
@Module({
  imports: [WebhooksModule],
  controllers: [AdminWebhooksController],
})
export class AdminWebhooksModule {}
