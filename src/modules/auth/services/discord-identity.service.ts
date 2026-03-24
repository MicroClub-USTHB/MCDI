import { Injectable } from '@nestjs/common';
import {
  DiscordOAuthProfile,
  DiscordService,
} from '../../discord/discord.service';
import { MemberRepository } from '../repositories/member.repository';

@Injectable()
export class DiscordIdentityService {
  constructor(
    private readonly discordService: DiscordService,
    private readonly memberRepository: MemberRepository,
  ) {}

  async exchangeCodeForAccessToken(
    code: string,
    redirectUri: string,
  ): Promise<string | null> {
    return this.discordService.exchangeOAuthCode(code, redirectUri);
  }

  async fetchProfile(
    accessToken: string,
  ): Promise<DiscordOAuthProfile | null> {
    return this.discordService.fetchOAuthProfile(accessToken);
  }

  async upsertMemberFromProfile(profile: DiscordOAuthProfile) {
    return this.memberRepository.upsert({
      id: profile.id,
      username: profile.username,
      globalName: profile.global_name || undefined,
      displayName: profile.display_name || profile.global_name || undefined,
      avatar: profile.avatar || undefined,
      email: profile.email || undefined,
      syncedAt: new Date(),
    });
  }

  async resolveIdentityFromAccessToken(accessToken: string) {
    const profile = await this.fetchProfile(accessToken);
    if (!profile) return null;

    const member = await this.upsertMemberFromProfile(profile);
    return { accessToken, profile, member };
  }

  async resolveIdentityFromOAuthCode(code: string, redirectUri: string) {
    const accessToken = await this.exchangeCodeForAccessToken(code, redirectUri);
    if (!accessToken) return null;

    return this.resolveIdentityFromAccessToken(accessToken);
  }
}
