import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { ProjectRepository } from './repositories/project.repository';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionRepository,
    MemberRepository,
    ProjectRepository,
  ],
  exports: [
    AuthService,
    SessionRepository,
    MemberRepository,
    ProjectRepository,
  ],
})
export class AuthModule { }
