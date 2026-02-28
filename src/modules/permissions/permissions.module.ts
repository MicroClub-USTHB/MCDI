import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';
import { PermissionCacheService } from './permission-cache.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PermissionsController],
  providers: [PermissionsRepository, PermissionsService, PermissionCacheService],
  exports: [PermissionsService, PermissionCacheService],
})
export class PermissionsModule { }

