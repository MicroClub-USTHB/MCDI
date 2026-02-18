import { Module } from '@nestjs/common';
import { ProjectAdminController } from './project-admin.controller';
import { ProjectAdminService } from './project-admin.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProjectAdminController],
  providers: [ProjectAdminService],
})
export class ProjectsModule {}
