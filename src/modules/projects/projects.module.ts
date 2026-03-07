import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { DatabaseModule } from '@/database/database.module';
import { ProjectsAccessController } from './projects-access.controller';
import { ProjectsAccessRepository } from './projects-access.repository';
import { ProjectsAccessService } from './projects-access.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectsController, ProjectsAccessController],
  providers: [
    ProjectsService,
    ProjectsRepository,
    ProjectsAccessRepository,
    ProjectsAccessService,
  ],
  exports: [ProjectsService, ProjectsRepository, ProjectsAccessRepository, ProjectsAccessService],
})
export class ProjectsModule {}
