import { Module } from '@nestjs/common';
import { SystemAdminGuard } from './guards/system-admin.guard';

@Module({
    providers: [SystemAdminGuard],
    exports: [SystemAdminGuard],
})
export class AuthModule {}
