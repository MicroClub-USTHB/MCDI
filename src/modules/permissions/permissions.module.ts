import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
