import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRepository } from './member.repository';
import { GetMembersQueryDto } from './dto/get-members-query.dto';
import { plainToInstance } from 'class-transformer';
import {
  MemberResponseDto,
  MemberSearchResponseDto,
} from './dto/member-response.dto';

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class MemberService {
  constructor(private readonly memberRepository: MemberRepository) {}

  async getMember(
    serverId: string,
    discordId: string,
  ): Promise<MemberResponseDto> {
    const member = await this.memberRepository.findMemberByDiscordId(
      serverId,
      discordId,
    );

    if (!member) {
      throw new NotFoundException(
        `Member with Discord ID ${discordId} not found in server ${serverId}`,
      );
    }

    return plainToInstance(MemberResponseDto, member, {
      excludeExtraneousValues: true,
    });
  }

  async searchMembers(
    serverId: string,
    queryDto: GetMembersQueryDto,
  ): Promise<PaginatedResponse<MemberSearchResponseDto>> {
    const { query, roleId, isClubMember, isActive } = queryDto;

    const dbPagination = queryDto.getDbPagination();

    const { members, total } = await this.memberRepository.searchMembers(
      serverId,
      query,
      roleId,
      dbPagination,
      isClubMember,
      isActive,
    );

    const data = members.map((member) =>
      plainToInstance(MemberSearchResponseDto, member, {
        excludeExtraneousValues: true,
      }),
    );

    const pages = Math.ceil(total / dbPagination.limit);
    const pagination = {
      page: dbPagination.page,
      limit: dbPagination.limit,
      total,
      pages,
      hasNext: dbPagination.page < pages,
      hasPrev: dbPagination.page > 1,
    };

    return { data, pagination };
  }
}
