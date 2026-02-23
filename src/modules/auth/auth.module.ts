import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { ProjectRepository } from './repositories/project.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { SystemAdminGuard } from './guards/system-admin.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionRepository,
    MemberRepository,
    ProjectRepository,
    OAuthStateRepository,
    SystemAdminGuard
  ],
  exports: [
    AuthService,
    SessionRepository,
    MemberRepository,
    ProjectRepository,
    OAuthStateRepository,
    SystemAdminGuard
  ],
})
export class AuthModule {}

