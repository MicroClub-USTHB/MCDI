import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';
import { InboundWebhooksController } from './inbound-webhooks.controller';
import { InboundWebhookIngestController } from './inbound-webhook-ingest.controller';
import { InboundWebhookReadController } from './inbound-webhook-read.controller';
import { InboundWebhooksService } from './inbound-webhooks.service';
import { InboundWebhooksRepository } from './inbound-webhooks.repository';
import { InboundWebhookReadGuard } from './guards/inbound-webhook-read.guard';

/**
 * ProjectsModule is imported for ApiKeyGuard's dependencies only. The
 * dependency stays one-way — nothing here is imported by ProjectsModule —
 * so no forwardRef is needed.
 */
@Module({
  imports: [DatabaseModule, RedisModule, AuditModule, ProjectsModule],
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
