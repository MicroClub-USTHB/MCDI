import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { DiscordIdentityService } from './services/discord-identity.service';
import { SessionIssuanceService } from './services/session-issuance.service';
import { SsoService } from './services/sso.service';
import { SessionRepository } from './repositories/session.repository';
import { MemberRepository } from './repositories/member.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { AuthRequestRepository } from './repositories/auth-request.repository';
import { AdminOAuthStateRepository } from './repositories/admin-oauth-state.repository';
import { CallbackCodeRepository } from './repositories/callback-code.repository';
import { SsoSessionRepository } from './repositories/sso-session.repository';
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
    DiscordIdentityService,
    SessionIssuanceService,
    SsoService,
    SessionRepository,
    MemberRepository,
    OAuthStateRepository,
    AuthRequestRepository,
    AdminOAuthStateRepository,
    CallbackCodeRepository,
    SsoSessionRepository,
    SystemAdminGuard,
  ],
  exports: [AuthService, AdminAuthService, SsoService],
})
export class AuthModule {}
