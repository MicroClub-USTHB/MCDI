import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuditModule } from '../audit/audit.module';

import { InboundWebhooksController } from './inbound-webhooks.controller';
import { InboundWebhookIngestController } from './inbound-webhook-ingest.controller';
import { InboundWebhookReadController } from './inbound-webhook-read.controller';
import { InboundWebhooksService } from './inbound-webhooks.service';
import { InboundWebhooksRepository } from './inbound-webhooks.repository';
import { InboundWebhookReadGuard } from './guards/inbound-webhook-read.guard';

@Module({
  imports: [DatabaseModule, RedisModule, AuditModule],
  controllers: [
    InboundWebhooksController,
    InboundWebhookIngestController,
    InboundWebhookReadController,
  ],
  providers: [
    InboundWebhooksService,
    InboundWebhooksRepository,
    InboundWebhookReadGuard,
  ],
  exports: [InboundWebhooksService, InboundWebhooksRepository],
})
export class InboundWebhooksModule {}
