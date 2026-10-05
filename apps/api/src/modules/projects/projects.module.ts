import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectAuthCacheService } from './project-auth-cache.service';
import { ProjectAccessCacheService } from './project-access-cache.service';
import { DatabaseModule } from '@/database/database.module';
import { RedisModule } from '../../common/redis/redis.module';

import { InboundWebhooksModule } from '../inbound-webhooks/inbound-webhooks.module';

@Module({
  imports: [DatabaseModule, RedisModule, InboundWebhooksModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsRepository,
    ProjectAuthCacheService,
    ProjectAccessCacheService,
  ],
  exports: [
    ProjectsService,
    ProjectsRepository,
    ProjectAuthCacheService,
    ProjectAccessCacheService,
  ],
})
export class ProjectsModule {}
