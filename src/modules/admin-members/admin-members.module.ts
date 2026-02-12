import { Module } from '@nestjs/common';
import { AdminMembersController } from './admin-members.controller';
import { AdminMembersService } from './admin-members.service';

@Module({
  controllers: [AdminMembersController],
  providers: [AdminMembersService],
})
export class AdminMembersModule {}
