import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { ProjectRepository } from './repositories/project.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { SystemAdminGuard } from './guards/system-admin.guard';
import {
  CLOCK,
  CryptoTokenGenerator,
  DISCORD_HTTP_CLIENT,
  FetchDiscordHttpClient,
  SystemClock,
  TOKEN_GENERATOR,
} from './providers';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionRepository,
    MemberRepository,
    ProjectRepository,
    OAuthStateRepository,
    SystemAdminGuard,
    { provide: DISCORD_HTTP_CLIENT, useClass: FetchDiscordHttpClient },
    { provide: CLOCK, useClass: SystemClock },
    { provide: TOKEN_GENERATOR, useClass: CryptoTokenGenerator },
  ],
  exports: [
    AuthService,
    SessionRepository,
    MemberRepository,
    ProjectRepository,
    OAuthStateRepository,
    SystemAdminGuard,
    DISCORD_HTTP_CLIENT,
    CLOCK,
    TOKEN_GENERATOR,
  ],
})
export class AuthModule {}
