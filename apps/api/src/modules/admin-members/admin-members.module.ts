import { Module } from '@nestjs/common';
import { AdminMembersController } from './admin-members.controller';
import { AdminMembersService } from './admin-members.service';
import { AdminMembersRepository } from './admin-members.repository';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminMembersController],
  providers: [AdminMembersService, AdminMembersRepository],
})
export class AdminMembersModule {}
