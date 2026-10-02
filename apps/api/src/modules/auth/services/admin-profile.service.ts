import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MemberRepository } from '../repositories/member.repository';
import {
  AdminProfileResponseDto,
  UpdateAdminProfileDto,
} from '../dto/admin-profile.dto';

type MemberRow = NonNullable<Awaited<ReturnType<MemberRepository['findById']>>>;

@Injectable()
export class AdminProfileService {
  constructor(private readonly memberRepository: MemberRepository) {}

  async getProfile(memberId: string): Promise<AdminProfileResponseDto> {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedException('Member not found');
    }
    return this.toResponse(member);
  }

  async updateProfile(
    memberId: string,
    dto: UpdateAdminProfileDto,
  ): Promise<AdminProfileResponseDto> {
    // Only `preferredName` is writable; every other profile field is owned by
    // Discord sync. An absent key means "no change".
    if (dto.preferredName === undefined) {
      return this.getProfile(memberId);
    }

    const next =
      typeof dto.preferredName === 'string'
        ? dto.preferredName.trim() || null
        : null;

    const updated = await this.memberRepository.setPreferredName(
      memberId,
      next,
    );
    if (!updated) {
      throw new UnauthorizedException('Member not found');
    }
    return this.toResponse(updated);
  }

  private toResponse(member: MemberRow): AdminProfileResponseDto {
    return {
      id: member.id,
      username: member.username,
      globalName: member.globalName,
      displayName: member.displayName,
      preferredName: member.preferredName,
      avatar: member.avatar,
      email: member.email,
      isSystemAdmin: member.isSystemAdmin,
    };
  }
}
