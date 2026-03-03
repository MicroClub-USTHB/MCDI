import { Module } from '@nestjs/common';
import { ProjectAdminController } from './project-admin.controller';
import { ProjectAdminService } from './project-admin.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { DatabaseModule } from '@/database/database.module';
import { ProjectsAccessController } from './projects-access.controller';
import { ProjectsAccessRepository } from './projects-access.repository';
import { ProjectsAccessService } from './projects-access.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    ProjectAdminController,
    ProjectsController,
    ProjectsAccessController,
  ],
  providers: [
    ProjectAdminService,
    ProjectsService,
    ProjectsRepository,
    ProjectsAccessRepository,
    ProjectsAccessService,
  ],
  exports: [ProjectsAccessService],
})
export class ProjectsModule {}
