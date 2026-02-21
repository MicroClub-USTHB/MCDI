import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberRepository } from './member.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [MemberController],
  providers: [MemberService, MemberRepository],
  exports: [MemberService, MemberRepository],
})
export class MembersModule {}
