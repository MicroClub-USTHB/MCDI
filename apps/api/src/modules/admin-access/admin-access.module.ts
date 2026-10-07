import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AdminAccessController } from './admin-access.controller';
import { AdminAccessGrantsService } from './admin-access-grants.service';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

/**
 * Global so that `AdminAccessGuard`, which many modules apply with
 * `@UseGuards`, can resolve `AdminAccessService` without each module
 * importing this one.
 */
@Global()
@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [AdminAccessController],
  providers: [
    AdminAccessRepository,
    AdminAccessService,
    AdminAccessGrantsService,
  ],
  exports: [AdminAccessService],
})
export class AdminAccessModule {}
