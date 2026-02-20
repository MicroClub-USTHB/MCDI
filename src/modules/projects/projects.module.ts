import { Module } from '@nestjs/common';
import { ProjectsAccessRepository } from './projects-access.repository';
import { ProjectsAccessService } from './projects-access.service';
import { ProjectsAccessController } from './projects-access.controller';

@Module({
  controllers: [ProjectsAccessController],
  providers: [ProjectsAccessRepository, ProjectsAccessService],
  exports: [ProjectsAccessService],    
})
export class ProjectsModule {}
