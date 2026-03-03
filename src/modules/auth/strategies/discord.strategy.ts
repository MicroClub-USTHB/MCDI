// src/auth/strategies/discord.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('DISCORD_CLIENT_ID')!,
      clientSecret: configService.get<string>('DISCORD_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('DISCORD_CALLBACK_URL')!,
      scope: ['identify', 'email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): unknown {
    const { id, username, discriminator, avatar, email } = profile;

    return {
      discordId: id,
      username,
      discriminator,
      avatar,
      email,
      accessToken,
    };
  }
}
