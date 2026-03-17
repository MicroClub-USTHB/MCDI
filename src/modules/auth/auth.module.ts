import { Module } from '@nestjs/common';
import { SystemAdminGuard } from './guards/system-admin.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionRepository } from './session.repository';

@Module({
  controllers: [AuthController],
  providers: [SystemAdminGuard, AuthService, SessionRepository],
  exports: [SystemAdminGuard, AuthService, SessionRepository],
})
export class AuthModule {}
