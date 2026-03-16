import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AuthRequestRepository } from './repositories/auth-request.repository';
import { CallbackCodeRepository } from './repositories/callback-code.repository';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { LoginTokenRepository } from './repositories/login-token.repository';
import { AdminOAuthStateRepository } from './repositories/admin-oauth-state.repository';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { DiscordModule } from '../discord/discord.module';
import { ProjectsModule } from '../projects/projects.module';
import { ServersModule } from '../servers/servers.module';

@Module({
  imports: [DiscordModule, ProjectsModule, ServersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminAuthService,
    AuthRequestRepository,
    CallbackCodeRepository,
    SessionRepository,
    MemberRepository,
    LoginTokenRepository,
    AdminOAuthStateRepository,
    SystemAdminGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
