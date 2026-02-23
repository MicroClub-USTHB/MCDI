import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberRepository } from './member.repository';
import { ProjectsModule } from '../projects/projects.module';
import { PermissionsModule } from '../permissions/permissions.module';
@Module({
  imports: [DatabaseModule, ProjectsModule, PermissionsModule],
  controllers: [MemberController],
  providers: [MemberService, MemberRepository],
  exports: [MemberService, MemberRepository],
})
export class MembersModule {}
