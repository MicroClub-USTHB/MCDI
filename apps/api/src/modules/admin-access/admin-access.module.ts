import { Global, Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

/**
 * Global so that `AdminAccessGuard`, which many modules apply with
 * `@UseGuards`, can resolve `AdminAccessService` without each module
 * importing this one. The grant-editing controller is added in Task 12.
 */
@Global()
@Module({
  imports: [PermissionsModule],
  providers: [AdminAccessRepository, AdminAccessService],
  exports: [AdminAccessService],
})
export class AdminAccessModule {}
