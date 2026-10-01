import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectAuthCacheService } from './project-auth-cache.service';
import { ProjectAccessCacheService } from './project-access-cache.service';
import { DatabaseModule } from '@/database/database.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
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
