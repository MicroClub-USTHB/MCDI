import { Module } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { MemberController } from './controllers/member.controller';
import { MemberService } from './services/member.service';
import { MemberRepository } from './repositories/member.repository';

@Module({
  imports: [],
  controllers: [MemberController],
  providers: [
    MemberService,
    MemberRepository,
    {
      provide: DRIZZLE,
      useExisting: DRIZZLE,
    },
  ],
  exports: [MemberService],
})
export class MembersModule {}
