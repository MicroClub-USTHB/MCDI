import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MemberService } from '../services/member.service';
import { GetMembersQueryDto } from '../dto/get-members-query.dto';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import {
  MemberResponseDto,
  MemberSearchResponseDto,
} from '../dto/member-response.dto';

@Controller('servers/:serverId/members')
@UseGuards(ApiKeyGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get(':discordId')
  async getMember(
    @Param('serverId') serverId: string,
    @Param('discordId') discordId: string,
  ): Promise<MemberResponseDto> {
    return await this.memberService.getMember(serverId, discordId);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchMembers(
    @Param('serverId') serverId: string,
    @Query() queryDto: GetMembersQueryDto,
  ): Promise<{
    data: MemberSearchResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return await this.memberService.searchMembers(serverId, queryDto);
  }
}
