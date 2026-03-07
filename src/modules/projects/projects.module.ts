import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { DatabaseModule } from '@/database/database.module';
import { ProjectsAccessController } from './projects-access.controller';
import { ProjectsAccessRepository } from './projects-access.repository';
import { ProjectsAccessService } from './projects-access.service';
import { ProjectAdminController } from './project-admin.controller';
import { ProjectAdminService } from './project-admin.service';
import { ProjectRepository } from '../auth/repositories/project.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectsController, ProjectsAccessController, ProjectAdminController],
  providers: [
    ProjectsService,
    ProjectsRepository,
    ProjectsAccessRepository,
    ProjectsAccessService,
    ProjectAdminService,
    ProjectRepository,
  ],
  exports: [ProjectsService, ProjectsRepository, ProjectsAccessRepository, ProjectsAccessService],
})
export class ProjectsModule {}
